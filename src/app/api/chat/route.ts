import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { toolDefinitions } from "@/lib/ai/tools";
import { handleToolCall } from "@/lib/ai/tool-handlers";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

function validateMessages(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
    throw new Error("messages array required.");
  }
  const msgs = (body as { messages: unknown[] }).messages;
  if (msgs.length > 40) throw new Error("Too many messages.");
  return msgs.map((m, i) => {
    if (
      typeof m !== "object" ||
      m === null ||
      (m as { role?: unknown }).role !== "user" && (m as { role?: unknown }).role !== "assistant" ||
      typeof (m as { content?: unknown }).content !== "string"
    ) {
      throw new Error(`Invalid message at index ${i}.`);
    }
    const content = String((m as { content: string }).content);
    if (content.length > 4000) throw new Error(`Message ${i} too long.`);
    return { role: (m as { role: "user" | "assistant" }).role, content };
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401 });
  }

  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = validateMessages(body);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        // Agentic loop: keep going until end_turn or no more tool calls
        const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let iterations = 0;
        while (iterations < 10) {
          iterations++;

          // Stream the first turn; use non-streaming for continuation turns
          if (iterations === 1) {
            const response = await client.messages.stream({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 2048,
              system: buildSystemPrompt(user),
              messages: anthropicMessages,
              tools: toolDefinitions,
            });

            const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
            let assistantText = "";

            for await (const event of response) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                assistantText += event.delta.text;
                emit({ type: "text", delta: event.delta.text });
              }
            }

            const finalMsg = await response.finalMessage();

            // Collect tool use blocks
            for (const block of finalMsg.content) {
              if (block.type === "tool_use") {
                toolUseBlocks.push(block);
              }
            }

            if (finalMsg.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
              break;
            }

            // Execute tools
            anthropicMessages.push({ role: "assistant", content: finalMsg.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              emit({ type: "tool_start", tool: block.name });
              try {
                const result = await handleToolCall(block.name, block.input as Record<string, unknown>);
                const resultStr = JSON.stringify(result);
                emit({ type: "tool_result", tool: block.name, preview: getToolPreview(block.name, result) });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: resultStr,
                });
              } catch (err) {
                const errMsg = `Error: ${String(err)}`;
                emit({ type: "tool_result", tool: block.name, preview: errMsg });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: errMsg,
                  is_error: true,
                });
              }
            }

            anthropicMessages.push({ role: "user", content: toolResults });
          } else {
            // Continuation turns: stream text
            const response = await client.messages.stream({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 2048,
              system: buildSystemPrompt(user),
              messages: anthropicMessages,
              tools: toolDefinitions,
            });

            const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

            for await (const event of response) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                emit({ type: "text", delta: event.delta.text });
              }
            }

            const finalMsg = await response.finalMessage();

            for (const block of finalMsg.content) {
              if (block.type === "tool_use") {
                toolUseBlocks.push(block);
              }
            }

            if (finalMsg.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
              break;
            }

            anthropicMessages.push({ role: "assistant", content: finalMsg.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              emit({ type: "tool_start", tool: block.name });
              try {
                const result = await handleToolCall(block.name, block.input as Record<string, unknown>);
                emit({ type: "tool_result", tool: block.name, preview: getToolPreview(block.name, result) });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (err) {
                const errMsg = `Error: ${String(err)}`;
                emit({ type: "tool_result", tool: block.name, preview: errMsg });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: errMsg,
                  is_error: true,
                });
              }
            }

            anthropicMessages.push({ role: "user", content: toolResults });
          }
        }

        emit({ type: "done" });
      } catch (err) {
        emit({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function getToolPreview(toolName: string, result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  switch (toolName) {
    case "get_attendance_summary": {
      const s = r.summary as Record<string, number> | undefined;
      return s ? `${s.totalRecords} records, ${s.uniqueEmployees} employees` : "";
    }
    case "get_employees": {
      const emps = r.employees as unknown[];
      return `${emps?.length ?? 0} employees`;
    }
    case "get_dashboard":
      return `Today: ${r.totalEmployees ?? 0} employees`;
    case "get_employee_absences": {
      const abs = r.absences as unknown[];
      return `${abs?.length ?? 0} employees, year ${r.year}`;
    }
    case "get_cook_report": {
      const groups = r.groups as unknown[];
      return `${groups?.length ?? 0} cook sessions`;
    }
    case "get_car_status": {
      const cars = r.cars as unknown[];
      return `${cars?.length ?? 0} cars`;
    }
    default:
      return "";
  }
}
