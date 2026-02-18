IPQC INDORE DASHBOARD

This dashboard fetches live data from a Google Apps Script Web App.
Data Source: https://script.google.com/macros/s/AKfycbzQ5mJy0xHcOYqUSuOrK4PpHaiEq8TaBJjSklkMT60UValpu3Ph2CvH2KqZ25hcEOLE/exec

### How to Run

Although the data is fetched from online, it is recommended to run this on a local server to ensure all dashboard features (like loading modules) work correctly.

**Option 1: Using Python (Recommended)**
1. Open a terminal/command prompt in this folder.
2. Run:
   - `python -m http.server` (for Python 3)
   - OR `python -m SimpleHTTPServer` (for Python 2)
3. Open your browser and go to: `http://localhost:8000`

**Option 2: Using Node.js**
1. Install http-server: `npm install -g http-server`
2. Run: `http-server`
3. Visit the URL shown in the terminal.

**Option 3: VS Code Live Server**
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

### Notes
- The dashboard automatically refreshes data every 30 seconds.
- Ensure you have an active internet connection to fetch the live data.
