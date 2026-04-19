# Web Serial Studio

A lightweight, web-based serial port monitor and data visualizer.

## Features
- 📈 Real-time data visualization with customizable widgets (Gauges, Plots, etc.)
- 💻 Integrated Serial and WebSocket drivers
- 🛠️ Project management: Save and load configurations
- 🔌 Web Serial API integration (works directly in the browser)

## Deployment (GitHub Pages)

This project is configured for automatic deployment to **GitHub Pages** using GitHub Actions.

### How to Deploy

1.  **Create a GitHub Repository**: Create a new, empty repository on GitHub.
2.  **Link and Push your code**:
    ```bash
    cd web-serial-studio
    # Replace <your-repo-url> with your actual repository URL
    git remote add origin <your-repo-url>
    git branch -M main
    git push -u origin main
    ```
3.  **Configure GitHub Pages**:
    *   Go to your repository on GitHub.
    *   Click on **Settings** > **Pages**.
    *   Under **Build and deployment** > **Source**, select **"GitHub Actions"**.
4.  **Wait for Deployment**:
    *   Once you push, the GitHub Action will trigger automatically.
    *   You can monitor the progress in the **Actions** tab.
    *   Once finished, your app will be live at `https://<your-username>.github.io/<your-repo-name>/`.

## Local Development

To run the application locally for testing:

1.  Navigate to the project directory:
    ```bash
    cd web-serial-studio
    ```
2.  Start a local web server (e.g., using Python):
    ```bash
    python3 -m http.server 8000
    ```
3.  Open your browser and navigate to `http://localhost:8000`.

> **Note**: Since the app uses ES Modules, you **must** use a local web server. Opening `index.html` directly in the browser via `file://` will result in CORS errors.