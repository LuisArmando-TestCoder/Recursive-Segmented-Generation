#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env

/// <reference lib="deno.ns" />

import { config } from "https://deno.land/x/dotenv/mod.ts";
import { join, resolve } from "https://deno.land/std/path/mod.ts";

// [LOADING ADDED] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
/**
 * Rainbow-style loading animation in the console.
 * This runs in parallel while files are being generated.
 */
let loading = false;
const frames = ["🌈", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];

async function startLoadingAnimation() {
  loading = true;
  let i = 0;
  while (loading) {
    Deno.stdout.writeSync(
      new TextEncoder().encode(`\rCreating files... ${frames[i]} `)
    );
    i = (i + 1) % frames.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log("\n✅ All files created!");
}
// [LOADING ADDED] <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

// -------------------------------------
// Utility function to ensure a directory exists (if not, create it).
// -------------------------------------
async function ensureDirectoryExists(dir: string) {
  try {
    await Deno.stat(dir);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(dir, { recursive: true });
      console.log(`Directory created: ${dir}`);
    } else {
      console.error(`Error accessing directory ${dir}:`, error);
      Deno.exit(1);
    }
  }
}

// -------------------------------------
// Load environment variables from .env file
// -------------------------------------
const env = config();
const API_KEY = env["API_KEY"];
if (!API_KEY) {
  console.error("API_KEY not found in the .env file");
  Deno.exit(1);
}

// -------------------------------------
// 1) Prompt for an absolute/relative path (default to current directory)
// -------------------------------------
const userInputPath = prompt(
  "1) Enter the absolute or relative path for your project folder (Press Enter for current folder): "
);
let basePath: string;
if (!userInputPath) {
  basePath = Deno.cwd();
} else {
  basePath = resolve(userInputPath);
}
await ensureDirectoryExists(basePath);

// -------------------------------------
// 2) Prompt for a project name (optional, defaults to 'project')
// -------------------------------------
const userProjectName = prompt(
  "2) Enter your project name (optional, defaults to 'project'): "
);
const projectName = userProjectName?.trim() || "project";

// Create the project's main folder inside basePath
const projectDir = join(basePath, projectName);
await ensureDirectoryExists(projectDir);

// -------------------------------------
// 3) Prompt for the main user prompt
// -------------------------------------
const userPrompt = String(prompt("3) Enter your prompt: "));
if (!userPrompt) {
  console.error("No prompt received.");
  Deno.exit(1);
}

function getBacktipsContent(content: string) {
  const backtipsContentRegex = /```.*?^```/gms;
  return backtipsContentRegex.exec(content)?.[1] || content;
}

// -------------------------------------
// Function to call the GPT-4 API
// -------------------------------------
async function callGPT4(promptText: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error calling the API: ${errorText}`);
  }

  const data = await response.json();
  // Assumes the response has data.choices[0].message.content
  return data.choices[0].message.content;
}

// -------------------------------------
// Resolve file paths so that all files are placed inside the project directory.
// -------------------------------------
function resolveFilePath(filename: string): {
  filePath: string;
  workDir: string;
} {
  // All files will be placed inside the projectDir.
  return { filePath: join(projectDir, filename), workDir: projectDir };
}

// -------------------------------------
// Step 1: Generate Global Context
// -------------------------------------
async function generateGlobalContext(
  userPrompt: string,
  baseSuffix: string
): Promise<string> {
  const promptForContext = `${userPrompt}\n${baseSuffix}\nPlease provide a high-level global context for the project.`;
  const globalContext = await callGPT4(promptForContext);
  await Deno.writeTextFile(
    join(projectDir, "global_context.txt"),
    globalContext
  );
  return globalContext;
}

// -------------------------------------
// Function to parse the plain text project structure
// Expected format per line: <filename>: <description>
// -------------------------------------
function parseStructureText(
  text: string
): Array<{ filename: string; description: string }> {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const files = [];
  for (const line of lines) {
    // Assuming a format like: "game_setup.py: Set up the game environment using Pygame."
    const parts = line.split(":");
    if (parts.length >= 2) {
      const filename = parts.shift()?.trim();
      const description = parts.join(":").trim();
      if (filename && description) {
        files.push({ filename, description });
      }
    }
  }
  return files;
}

// -------------------------------------
// Step 2: Generate Project Structure (as plain text)
// -------------------------------------
async function generateProjectStructure(
  userPrompt: string,
  baseSuffix: string,
  globalContext: string
): Promise<Array<{ filename: string; description: string }>> {
  const promptForStructure = 
      `Using the following global context:
      ${globalContext}
      
      And the base prompt:
      ${userPrompt}
      
      plus these segmentation instructions:
      ${baseSuffix}
      
      Please provide a list of files required for the project.
      Each file should be on a separate line in the following format:
      <filename>: <description>
      Do not include any additional commentary or markdown formatting.
      `;
  const structureText = await callGPT4(promptForStructure);
  await Deno.writeTextFile(
    join(projectDir, "project_structure.txt"),
    structureText
  );
  return parseStructureText(structureText);
}

// -------------------------------------
// Step 3: Recursive File Generation and Audit
// -------------------------------------
async function processFileNode(
  fileNode: { filename: string; description: string },
  context: string
) {
  // Generate file content based on its description and context.
  const filePrompt = 
      `Context:
      ${context}
      
      File Objective: ${fileNode.description}
      
      Please generate the complete content for the file '${fileNode.filename}'.
      Ensure it adheres to best practices and includes necessary modular segmentation.
      Return only the file content.`;
  let fileContent = getBacktipsContent(await callGPT4(filePrompt));

  // Audit loop: verify the file content is appropriate.
  let approved = false;
  while (!approved) {
    const auditPrompt = 
        `Please audit the following file content strictly in the context of the project:
        ${fileContent}

        The file is supposed to accomplish: ${fileNode.description}

        If the code meets the objectives and best practices, respond with exactly "approved" (no extra text).
        Otherwise, provide only the updated code with no additional commentary, explanations, or formatting.

        Do not include any additional commentary or markdown formatting.

        Generate only the raw code without any explanations, annotations, or formatting. 
        Do not include triple backticks (\`\`\`), language labels, or any surrounding text. 
        Just return the code itself, nothing else.

        When you are going to respond, and display the audit, don't display the audit, 
        respond, only, with the entirety of the embedded code.
        `;
    const auditResponse = await callGPT4(auditPrompt);
    if (auditResponse.toLowerCase().includes("approved")) {
      approved = true;
    } else {
      // If changes are suggested, update file content and re-audit.
      fileContent = getBacktipsContent(auditResponse);
    }
  }

  // Write the final file inside the project directory.
  const { filePath } = resolveFilePath(fileNode.filename);
  await Deno.writeTextFile(filePath, fileContent);
  console.log(`Generated and audited file: ${filePath}`);

  // Optionally, execute the file if it is a script.
  if (fileNode.filename.endsWith(".py") || fileNode.filename.endsWith(".js")) {
    console.log(`Executing ${filePath}...`);
    const process = Deno.run({
      cmd: fileNode.filename.endsWith(".py")
        ? ["python", filePath]
        : ["deno", "run", filePath],
      stdout: "piped",
      stderr: "piped",
    });
    const status = await process.status();
    const output = new TextDecoder().decode(await process.output());
    const error = new TextDecoder().decode(await process.stderrOutput());
    process.close();
    if (status.code === 0) {
      console.log(`Execution of ${filePath} successful:\n${output}`);
    } else {
      console.error(`Execution of ${filePath} failed:\n${error}`);
    }
  }
}

// -------------------------------------
// Recursive function to traverse the file list (flat structure)
// -------------------------------------
async function traverseStructure(
  files: Array<{ filename: string; description: string }>,
  context: string
) {
  for (const node of files) {
    await processFileNode(node, context);
  }
}

// -------------------------------------
// Main flow
// -------------------------------------
async function main() {
  if (!userPrompt) {
    console.error("No prompt provided.");
    Deno.exit(1);
  }
  const baseSuffix = 
      `Segment all necessary stages to achieve the prompt’s objective into file names that reflect their main generative function.
      Write a global project context that includes the central objective, the current objective of each function, 
      the schemas of previously generated files, and their position in the chain.
      Then, generate a list of files required for the project.
      Each file should be on a separate line in the following format:
      <filename>: <description>
      Do not include any additional commentary or markdown formatting.
      Each generated file must include a prompt to the same API using the current script's code as context.

      Do not include any additional commentary or markdown formatting.

      Generate only the raw code without any explanations, annotations, or formatting. 
      Do not include triple backticks (\`\`\`), language labels, or any surrounding text. 
      Just return the code itself, nothing else.
      `;

  // Generate global context inside the project directory.
  const globalContext = await generateGlobalContext(userPrompt, baseSuffix);

  // Generate project structure as plain text and parse it into file nodes.
  const projectStructure = await generateProjectStructure(
    userPrompt,
    baseSuffix,
    globalContext
  );

  // [LOADING ADDED] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // Start the loading animation before file generation
  const loadingAnimation = startLoadingAnimation();
  // [LOADING ADDED] <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

  // Process each file node based on the parsed structure.
  await traverseStructure(projectStructure, globalContext);

  // [LOADING ADDED] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // Stop the loading animation after all files are generated
  loading = false;
  await loadingAnimation;
  // [LOADING ADDED] <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
}

// -------------------------------------
// Invoke main
// -------------------------------------
main();
