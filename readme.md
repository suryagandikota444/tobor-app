# Robot Control React App

This is a simple React application designed to control a robot over WiFi.

## Functionality

The application provides a user interface with a touchpad-like control. Dragging on this touchpad sends commands to the robot to control its motors.

-   **Motor Control:** Uses HTTP GET requests to send angle commands to the robot's API endpoint (e.g., `http://192.168.4.1/set_angle`).
-   **User Interface:** Built with React, TypeScript, and components from Shadcn/UI (Dialog).

## How it Works

The main control interface is within a modal dialog. When the user interacts with the touchpad:
1.  Mouse or touch movements are captured.
2.  These movements are translated into angle changes for three motors.
3.  HTTP GET requests are sent in real-time to the robot's configured IP address and endpoint, specifying the servo number and the desired angle.
    -   Example: `http://192.168.4.1/set_angle?servo=1&angle=90`

## Client Setup

This is a frontend application. To run it locally (assuming you have Node.js and npm/yarn installed):
1.  Navigate to the `client` directory.
2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically open the application in your web browser.

**Note:** For the robot control to function, the robot (e.g., an ESP32) must be connected to the same WiFi network and have its HTTP server running and accessible at the configured IP address (e.g., `http://192.168.4.1`).
