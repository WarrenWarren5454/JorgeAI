# JorgeAI - UH Phone Search Tool (WIP)

> **⚠️ WORK IN PROGRESS ⚠️**  
> This application is currently under active development and may contain bugs or incomplete features.

## Overview

JorgeAI is a desktop application designed to assist University of Houston Help Desk Analysts in quickly finding phone numbers for various UH departments. The application uses an AI-powered approach to search for and validate phone numbers, with a self-improving cache system that learns from user feedback.

## Features

- **AI-Powered Search**: Uses Gemini AI to interpret queries and find the right department
- **Web Scraping**: Automatically extracts phone numbers from UH websites
- **Smart Cache**: Stores validated phone numbers for instant retrieval
- **Validation System**: Users can validate search results to improve the system
- **Modern UI**: Clean, responsive interface with UH branding

## How It Works

1. **Search Query**: Enter a department name in the search box
2. **AI Interpretation**: The system uses AI to interpret your query and standardize the department name
3. **Cache Check**: The system first checks if the phone number is already in the cache
4. **Web Search**: If not in cache, the system searches UH websites for relevant pages
5. **Phone Extraction**: Phone numbers are extracted from the pages
6. **AI Disambiguation**: AI analyzes the phone numbers to identify the correct one
7. **Validation**: You can validate the result with 👍 (Good) or 👎 (Bad) buttons
8. **Cache Update**: Validated phone numbers are added to the cache for future use

## Current Status

This project is currently in active development. The following features are being worked on:

- Improving AI query interpretation accuracy
- Enhancing the web scraping capabilities
- Expanding the cache with more validated phone numbers
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
2. **Validate Results**: If the result is from a web search, validate it with 👍 (Good) or 👎 (Bad)
3. **View All Departments**: Browse the list of all departments and their phone numbers

## Project Structure

- `main.js`: Main Electron application logic with AI integration
- `index.html`: User interface
- `data/`: Directory containing the phone number database and cache
- `.env`: Environment variables for API keys

## Contributing

This is a personal project, but suggestions and feedback are welcome. Please open an issue to discuss potential improvements.

## License

This project is for personal use only.

---

*Last updated: April 2024* 