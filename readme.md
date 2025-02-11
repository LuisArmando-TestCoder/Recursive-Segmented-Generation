# Recursive Segmented Generation (RSG)

**(Cuz a true coder automates himself, even it's own audits)**

This script is a Deno-based CLI tool that takes a user prompt and generates an automated project structure by interacting with **GPT-4o**. It follows best software architecture practices, segmenting the project into multiple files and directories, executing them recursively, and then performing an audit step to validate the generated output.

---

## 📥 Installation Guide

### 1. Prerequisites

Install **Deno** (if not already installed):

```sh
curl -fsSL https://deno.land/x/install/install.sh | sh
```

Or use a package manager like **brew**:

```sh
brew install deno
```

### 2. Clone or Download the Script

Download or clone the script into a directory:

```sh
git clone https://github.com/LuisArmando-TestCoder/Recursive-Segmented-Generation.git
cd Recursive-Segmented-Generation
```

### 3. Install as a Global Command

To make it available system-wide, install the script globally (e.g., `rsg` as command name):

```sh
deno install --global --allow-read --allow-write --allow-net --allow-env -f --name rsg ./rsg.ts
```

Now you can run `rsg` from anywhere in your terminal.

---

### 4. Add Deno's Bin Directory to Your PATH

After installing, you need to make sure your terminal knows where to find the `rsg` command. The installation process places the executable in a folder (by default, `C:\Users\<YourUsername>\.deno\bin` on Windows). Follow the instructions for your operating system:

#### **Windows**

- **Temporary (current session only):**

  Open PowerShell or Command Prompt and run:

  ```powershell
  $env:PATH += ";C:\Users\<YourUsername>\.deno\bin"
  ```

  or

  ```sh
  set PATH=%PATH%;C:\Users\<YourUsername>\.deno\bin
  ```

  Replace `<YourUsername>` with your actual Windows username.

- **Permanent:**

  1. Open the **Start Menu**, search for **"Environment Variables"**, and select **"Edit the system environment variables"**.
  2. In the **System Properties** window, click **"Environment Variables..."**.
  3. Under **User variables** (or **System variables** if you want it for all users), find and select **PATH**, then click **Edit**.
  4. Click **New** and add:
     ```
     C:\Users\<YourUsername>\.deno\bin
     ```
  5. Click **OK** to close all dialogs.
  6. Restart your terminal to apply the changes.

#### **macOS / Linux**

- Open your shell configuration file (e.g., `~/.bashrc`, `~/.zshrc`, or `~/.profile`) and add the following line:
  ```sh
  export PATH="$HOME/.deno/bin:$PATH"
  ```
- Save the file and then source it (or restart your terminal):
  ```sh
  source ~/.bashrc  # or the relevant file
  ```

Once the PATH is correctly set, you can run `rsg` from any terminal window.

---

## 🚀 Usage Guide

### 1. Prepare Your API Key

Create a `.env` file in the script directory and add your **OpenAI** API key:

```ini
API_KEY=your_openai_api_key
```

Ensure the `.env` file is in the same directory where the script runs.

### 2. Run the Generator

Simply run:

```sh
rsg
```

As soon as you do, you will be prompted for the following:

1. **Absolute or relative path** (defaults to your current working directory if left blank).
2. **Project name** (optional, defaults to `project` if left blank).
3. **Main user prompt** describing what you want the tool to generate.

Follow the interactive prompts in your terminal. Once you provide the three inputs, the script:

- Uses the path and project name to set up the required folder structure.
- Sends your prompt (plus some extra context) to **GPT-4o**.
- Receives a JSON structure describing the files to create.
- Generates and executes these files, and finally requests an **audit** from GPT-4o.

---

## 📜 Project Algorithm Summary

The script follows these steps:

1. **Setup Phase**

   - **Prompts** the user in order for the path to the project folder, the project name, and the main user prompt.
   - **Ensures** the directories exist (creating them if they don’t).
   - Loads the API key from `.env`.

2. **Extended Prompt Generation**

   - Concatenates the user’s prompt with additional instructions (suffix) to segment the project using best software architecture practices.

3. **Project Files Generation**

   - Calls **GPT-4o** to get a JSON response describing the project files. These files are placed in the specified path.
   - Files that belong in the project folder go under `/<projectName>`, while generator scripts remain in the parent directory (depending on how GPT-4o segments them).

4. **Automatic Execution**

   - Each generated file is executed right away to demonstrate functionality or perform additional generation steps.

5. **Audit Phase**
   - Sends an additional request (audit prompt) to **GPT-4o**, providing the files generated for a final review.
   - Outputs the audit results in your terminal.

---

## 📌 Example Use Case

### User Input (Interactive Prompts)

1. **Project Path**: `/Users/yourname/my-new-cli`
2. **Project Name**: `awesome-gen`
3. **Main Prompt**: `"Create a REST API in Deno that interacts with a PostgreSQL database."`

### Generated Output

Assuming you entered `/Users/yourname/my-new-cli` as your path and `awesome-gen` as your project name, you might see:

```
/my-new-cli/
  ├── generator.ts  <-- Handles automation logic
  ├── awesome-gen/
  │   ├── main.ts    <-- Entry point for the REST API
  │   ├── routes.ts  <-- Defines API routes
  │   ├── database.ts <-- Handles PostgreSQL connection
  │   ├── config.ts  <-- Manages configuration
  │   ├── audit.log  <-- GPT-4o audit feedback
```

---

## ✅ Features

✔️ **Interactive Prompts** – Asks for path, project name, and user prompt in sequence.  
✔️ **Recursive Automation** – The generator creates files that reference and extend themselves.  
✔️ **Best Practices in Software Architecture** – Uses clean segmentation for better maintainability.  
✔️ **Audit System** – Ensures the generated project is correctly structured by requesting a final review.  
✔️ **Runs as a CLI Tool** – Easily installable and accessible from anywhere.

---

## 💡 Future Improvements

- Add support for **custom project templates**.
- Enable users to specify **frameworks or libraries** (e.g., Express, React, etc.).
- Store **user preferences** for project structures.
- Implement **caching** to reduce redundant API calls.

---

## 💬 Questions or Issues?

If you encounter any issues, feel free to open an issue on **GitHub** or contribute with improvements! 🚀
