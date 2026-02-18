This dashboard requires a local web server to function correctly because it needs to fetch the local Excel file (`IPQC Records (5).xlsx`). Browsers block direct file access for security reasons.

### How to Run

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
- The dashboard automatically data every 30 seconds.
- Ensure the Excel file name matches `IPQC Records (5).xlsx` exactly.
