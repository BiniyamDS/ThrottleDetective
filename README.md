# Throttle Detective 🕵️‍♂️

**A simple tool to help check if your ISP might be throttling your internet speed.**

This web page runs download speed tests repeatedly and tracks how much data you've downloaded *using this tool*. It plots the speed results against the total data used on a chart. If you see your speed consistently drop after downloading a certain amount of data, your ISP *might* be throttling your connection.

## Features

*   Runs automatic download speed tests every few seconds.
*   Shows current speed, average speed, total data downloaded (by the tool), and test duration.
*   Displays a chart plotting speed vs. data used.
*   Saves test data in your browser so it persists if you refresh the page.
*   Simple Start/Stop controls.
*   Clean, modern interface.

## How to Run

1.  **Download or Clone:** Get the project files (`index.html`, `styles.css`, `main.js`).
2.  **Open:** Double-click `index.html` to open it in your web browser.
    *   *(Optional, Recommended): For best results, serve the files using a simple local server (like the "Live Server" VS Code extension or Python's `http.server`).*

## How to Use

1.  Click **"Start Test"**.
2.  Watch the **"Test Results"** section update and observe the **"Speed Chart"**.
3.  Look for trends: Does the speed drop significantly after reaching a certain "Total Data Downloaded"?
4.  Click **"Stop Test"** when you're done.

## Disclaimer ⚠️

Speed test results can vary due to many factors (Wi-Fi, network congestion, server load). This tool provides an indication, **not** definitive proof, of ISP throttling.

## License

MIT License.