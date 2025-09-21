# Steroid

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command palette for your browser, inspired by the power-user workflows of tools like IntelliJ and VS Code. Steroid gives you a quick, keyboard-first way to interact with your browser tabs.

![Steroid Demo](https://place-holder.com/gif/steroid-demo.gif) 
*(TODO: Add a GIF of the extension in action)*

## Features

-   **Command Palette**: Press `Shift+Shift` on any page to open the command palette.
-   **Fuzzy Tab Search**: Instantly search through all your open tabs by title or URL.
-   **Tab Management**:
    -   Switch to any tab without leaving the keyboard.
    -   Close tabs directly from the search results.
-   **Quick Actions**:
    -   **Google Search**: Type `g ` or `google ` followed by your query to start a search.
    -   **Open URL**: Type a URL and hit enter to open it in a new tab.

## Getting Started

To use this extension, you can load it locally in a Chromium-based browser (like Google Chrome, Brave, or Edge).

1.  **Download the code**: Clone this repository to your local machine.
    ```bash
    git clone https://github.com/amankhandelwal/steroid.git
    ```
2.  **Build the extension**: You need to have Node.js and npm installed.
    ```bash
    cd steroid
    npm install
    npm run build
    ```
    This will create a `dist` directory containing the production-ready extension files.

3.  **Load the extension in your browser**:
    -   Navigate to `chrome://extensions` (or the equivalent in your browser).
    -   Enable **"Developer mode"** (usually a toggle in the top-right).
    -   Click **"Load unpacked"**.
    -   Select the `dist` folder that was created in the previous step.

The extension is now installed! Go to any website and press `Shift+Shift` to try it out.

## Development

We welcome contributions! If you want to develop and contribute to Steroid, here's how to set up your environment.

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Run the development server**:
    ```bash
    npm run dev
    ```
    This command starts Vite in watch mode. Any changes you make to the source code will be automatically rebuilt. To see your changes, you may need to reload the extension from the `chrome://extensions` page.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

## License

Distributed under the MIT License. See `LICENSE` for more information.