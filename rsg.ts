#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env

import { config } from "https://deno.land/x/dotenv/mod.ts";
import { join, resolve, dirname } from "https://deno.land/std/path/mod.ts";

// Load environment variables from .env file
const env = config();
const API_KEY = env["API_KEY"];
if (!API_KEY) {
  console.error("API_KEY not found in the .env file");
  Deno.exit(1);
}

// Determine the base path from arguments or use the current working directory
const basePath = Deno.args[0] ? resolve(Deno.args[0]) : Deno.cwd();

// Ensure the basePath exists; if not, create it.
try {
  const stat = await Deno.stat(basePath);
  if (!stat.isDirectory) {
    console.error(`Base path is not a directory: ${basePath}`);
    Deno.exit(1);
  }
} catch (e) {
  if (e instanceof Deno.errors.NotFound) {
    try {
      await Deno.mkdir(basePath, { recursive: true });
      console.log(`Base directory created: ${basePath}`);
    } catch (err) {
      console.error("Error creating base directory:", err);
      Deno.exit(1);
    }
  } else {
    console.error("Error accessing base directory:", e);
    Deno.exit(1);
  }
}

// Define the path for the final project, inside a subfolder "project"
const projectDir = join(basePath, "project");
try {
  await Deno.mkdir(projectDir, { recursive: true });
  console.log(`Project directory created or already exists: ${projectDir}`);
} catch (error) {
  console.error("Error creating the 'project' directory:", error);
  Deno.exit(1);
}

// Read the user's prompt from the terminal
const userPrompt = prompt("Enter your prompt: ");
if (!userPrompt) {
  console.error("No prompt received.");
  Deno.exit(1);
}

// Define the updated suffix indicating segmentation and best practices
const suffix =
  "Segment all necessary stages to achieve the prompt’s objective into file names that reflect their main generative function. Write a global project context that includes the central objective, the current objective of each function, the schemas of previously generated files, and their position in the chain. Then, create a Deno script that generates these files and executes them one by one, ensuring that each file includes a prompt to the same API using the current script's code as context. The final project must be segmented following best software architecture practices based on the project's needs: files that form the final project should be placed in the 'project' subfolder, while generator files should remain in the parent folder. If the task is segmentable, each file must include this same suffix; otherwise, leave it without a suffix.";

// Concatenate the user's prompt with the suffix
const extendedPrompt = `${userPrompt}\n${suffix}`;

// Function to call the GPT-4 API
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
  return data.choices[0].message.content;
}

// Function to determine the file writing path and execution directory
function resolveFilePath(filename: string): {
  filePath: string;
  workDir: string;
} {
  if (filename.startsWith("project/")) {
    const relativePath = filename.substring("project/".length);
    return { filePath: join(projectDir, relativePath), workDir: projectDir };
  }
  return { filePath: join(basePath, filename), workDir: basePath };
}

// Function to audit the generated project files using GPT-4
async function auditProject(
  generatedFiles: Array<{ filename: string }>,
  projectContext: string
): Promise<void> {
  const fileList = generatedFiles.map((file) => file.filename).join("\n");
  const auditPrompt =
    "Audit the generated project files for adherence to the intended architecture and project context. " +
    "The project context is as follows:\n" +
    projectContext +
    "\n\n" +
    "The following files were generated:\n" +
    fileList +
    "\n\n" +
    "Please provide an audit report discussing whether the files adhere to the intended segmentation and software architecture best practices, and suggest any improvements.";

  console.log("Sending audit prompt to GPT-4...");
  try {
    const auditResponse = await callGPT4(auditPrompt);
    console.log("Audit Report from GPT-4:\n", auditResponse);
  } catch (error) {
    console.error("Error during audit API call:", error);
  }
}

// Main function orchestrating the project generation
async function main() {
  try {
    console.log("Sending extended prompt to GPT-4...");
    const gptResponse = await callGPT4(extendedPrompt);
    console.log("GPT-4 response received.");

    // Assumption 1: The response is valid JSON containing a "files" array.
    let projectData: { files: Array<{ filename: string; content: string }> } = {
      files: [],
    };
    try {
      projectData = JSON.parse(gptResponse);
    } catch (e) {
      console.error("Error parsing GPT-4 response as JSON.");
      console.log("Received content:", gptResponse);
      Deno.exit(1);
    }

    if (!projectData.files || !Array.isArray(projectData.files)) {
      console.error("The response does not contain a file list in 'files'.");
      Deno.exit(1);
    }

    // Read the content of the current script for context
    const currentScriptPath = new URL(import.meta.url).pathname;
    const currentScript = await Deno.readTextFile(currentScriptPath);

    // Process each file defined in the response
    for (const file of projectData.files) {
      const { filePath, workDir } = resolveFilePath(file.filename);
      const contextHeader = `/* Context from the main script:\n${currentScript}\n*/\n\n`;
      const fileContent = contextHeader + file.content;

      const fileDir = dirname(filePath);
      await Deno.mkdir(fileDir, { recursive: true });

      await Deno.writeTextFile(filePath, fileContent);
      console.log(`File generated: ${filePath}`);

      console.log(`Executing ${filePath}...`);
      const process = Deno.run({
        cmd: ["deno", "run", "--allow-read", "--allow-net", filePath],
        cwd: workDir,
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await process.status();
      const rawOutput = await process.output();
      const rawError = await process.stderrOutput();
      process.close();

      const output = new TextDecoder().decode(rawOutput);
      const errorOutput = new TextDecoder().decode(rawError);

      if (code === 0) {
        console.log(`Successfully executed ${filePath}:\n${output}`);
      } else {
        console.error(`Error executing ${filePath}:\n${errorOutput}`);
      }
    }

    // After file generation and execution, perform an audit of the project
    await auditProject(projectData.files, extendedPrompt);
  } catch (error) {
    console.error("Error in the process:", error);
  }
}

main();
