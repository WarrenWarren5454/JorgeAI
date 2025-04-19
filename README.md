# JorgeAI - UH Phone Search Tool (WIP)

> **⚠️ WORK IN PROGRESS ⚠️**  
> This application is currently under active development and may contain bugs or incomplete features.

## Overview

JorgeAI is a desktop application designed to assist University of Houston Help Desk Analysts in quickly finding phone numbers for various UH departments. The application uses a database-driven approach to store and retrieve verified phone numbers, eliminating the need to search through multiple websites.

## Features

- **Phone Number Search**: Quickly find phone numbers for UH departments
- **Department Database**: Store and manage verified phone numbers
- **AI-Powered Query Interpretation**: Understand natural language queries to find the right department
- **Modern UI**: Clean, responsive interface with UH branding

## Current Status

This project is currently in active development. The following features are being worked on:

- Building a comprehensive database of UH department phone numbers
- Improving AI query interpretation accuracy
- Enhancing the user interface
- Adding additional search capabilities

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_SEARCH_API_KEY=your_google_search_api_key
   SEARCH_ENGINE_ID=your_search_engine_id
   ```
4. Start the application:
   ```
   npm start
   ```

## Usage

1. **Search for a Phone Number**: Enter a department name in the search box and click "Search"
2. **Add a Phone Number**: Use the "Add a Phone Number" form to add verified phone numbers to the database
3. **View All Departments**: Browse the list of all departments and their phone numbers

## Project Structure

- `main.js`: Main Electron application logic
- `index.html`: User interface
- `data/`: Directory containing the phone number database
- `.env`: Environment variables for API keys

## Contributing

This is a personal project, but suggestions and feedback are welcome. Please open an issue to discuss potential improvements.

## License

This project is for personal use only.

---

*Last updated: April 2024* 