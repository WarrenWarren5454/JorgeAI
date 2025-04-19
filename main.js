const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Path configurations
const dataDir = path.join(__dirname, 'data');
const phoneDatabaseFile = path.join(dataDir, 'phone_database.json');
const cacheFile = path.join(dataDir, 'phone_cache.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize phone database if it doesn't exist
if (!fs.existsSync(phoneDatabaseFile)) {
    const initialDatabase = {
        departments: [],
        metadata: {
            last_updated: new Date().toISOString()
        }
    };
    fs.writeFileSync(phoneDatabaseFile, JSON.stringify(initialDatabase, null, 2));
}

// Initialize cache if it doesn't exist
if (!fs.existsSync(cacheFile)) {
    const initialCache = {
        cache: {},
        metadata: {
            last_updated: new Date().toISOString(),
            cache_duration_days: 30
        }
    };
    fs.writeFileSync(cacheFile, JSON.stringify(initialCache, null, 2));
}

// Database management functions
function readPhoneDatabase() {
    try {
        const data = fs.readFileSync(phoneDatabaseFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading phone database:', error);
        return { departments: [], metadata: { last_updated: new Date().toISOString() } };
    }
}

function writePhoneDatabase(data) {
    try {
        fs.writeFileSync(phoneDatabaseFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to phone database:', error);
        return false;
    }
}

// Function to add a new phone number to the database
function addPhoneNumber(department, phoneNumber) {
    const database = readPhoneDatabase();
    
    // Check if department already exists
    const existingIndex = database.departments.findIndex(dept => 
        dept.name.toLowerCase() === department.toLowerCase()
    );
    
    if (existingIndex >= 0) {
        // Update existing department
        database.departments[existingIndex].phoneNumber = phoneNumber;
    } else {
        // Add new department
        database.departments.push({
            name: department,
            phoneNumber: phoneNumber,
            added: new Date().toISOString()
        });
    }
    
    // Update metadata
    database.metadata.last_updated = new Date().toISOString();
    
    // Write to file
    return writePhoneDatabase(database);
}

// Function to search for a phone number in the database
function searchPhoneDatabase(query) {
    const database = readPhoneDatabase();
    const normalizedQuery = query.toLowerCase().trim();
    
    // First, try exact match
    const exactMatch = database.departments.find(dept => 
        dept.name.toLowerCase() === normalizedQuery
    );
    
    if (exactMatch) {
        return {
            success: true,
            message: 'Found exact match',
            data: {
                department: exactMatch.name,
                phoneNumber: exactMatch.phoneNumber
            },
            source: 'database'
        };
    }
    
    // Then, try partial match
    const partialMatches = database.departments.filter(dept => 
        dept.name.toLowerCase().includes(normalizedQuery) || 
        normalizedQuery.includes(dept.name.toLowerCase())
    );
    
    if (partialMatches.length > 0) {
        // Return the first partial match
        return {
            success: true,
            message: 'Found partial match',
            data: {
                department: partialMatches[0].name,
                phoneNumber: partialMatches[0].phoneNumber
            },
            source: 'database'
        };
    }
    
    // No match found
    return {
        success: false,
        message: 'No matching department found',
        error: 'Department not found in database'
    };
}

// Cache management functions
function readCache() {
    try {
        const data = fs.readFileSync(cacheFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading cache:', error);
        return { cache: {}, metadata: { last_updated: new Date().toISOString(), cache_duration_days: 30 } };
    }
}

function writeCache(data) {
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to cache:', error);
        return false;
    }
}

function isCacheValid(timestamp) {
    const cache = readCache();
    const cacheDuration = cache.metadata.cache_duration_days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const now = new Date();
    const cacheTime = new Date(timestamp);
    return (now - cacheTime) < cacheDuration;
}

// Web scraping function
async function scrapeWebsite(url) {
    try {
        console.log(`Scraping: ${url}`);
        const response = await axios.get(url, {
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract all text content
        const text = $('body').text();
        
        // Extract phone numbers using multiple regex patterns
        const phonePatterns = [
            /(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g, // Standard format
            /(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g, // With country code
            /\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g, // Without country code
            /([0-9]{3})[-.]?([0-9]{3})[-.]?([0-9]{4})/g // Just numbers
        ];
        
        let phones = [];
        for (const pattern of phonePatterns) {
            const matches = text.match(pattern) || [];
            phones = [...phones, ...matches];
        }
        
        // Remove duplicates and normalize format
        phones = [...new Set(phones)].map(phone => {
            // Remove all non-numeric characters
            const digits = phone.replace(/\D/g, '');
            // Format as (XXX) XXX-XXXX
            if (digits.length === 10) {
                return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
            }
            return phone;
        });
        
        console.log(`Found ${phones.length} phone numbers at ${url}`);
        
        return {
            url,
            content: text,
            phones: phones
        };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error(`Page not found: ${url}`);
        } else {
            console.error(`Error scraping ${url}:`, error.message);
        }
        return null;
    }
}

// Google search function
async function searchGoogle(query) {
    try {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const searchEngineId = process.env.SEARCH_ENGINE_ID;
        
        // Add site:uh.edu to limit results to UH websites
        const searchQuery = `${query} site:uh.edu`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}`;
        
        console.log(`Searching Google for: ${searchQuery}`);
        const response = await axios.get(url);
        
        if (response.data && response.data.items) {
            // Extract the first 5 URLs from the search results
            const urls = response.data.items.slice(0, 5).map(item => item.link);
            console.log(`Found ${urls.length} URLs from Google search`);
            return urls;
        }
        
        console.log('No search results found');
        return [];
    } catch (error) {
        console.error('Google search error:', error.response?.data || error.message);
        return [];
    }
}

// Add a function to validate phone numbers
function validatePhoneNumber(phone, query) {
    // Known correct phone numbers for common departments
    const knownPhones = {
        'hr': '(713) 743-3988',
        'human resources': '(713) 743-3988',
        'housing': '(713) 743-6000',
        'student housing': '(713) 743-6000',
        'residence': '(713) 743-6000',
        'it': '(713) 743-1411',
        'help desk': '(713) 743-1411',
        'uit': '(713) 743-1411',
        'information technology': '(713) 743-1411',
        'library': '(713) 743-9800',
        'libraries': '(713) 743-9800',
        'parking': '(713) 743-1099',
        'transportation': '(713) 743-1099',
        'admission': '(713) 743-1010',
        'admissions': '(713) 743-1010',
        'apply': '(713) 743-1010',
        'financial': '(713) 743-1010',
        'aid': '(713) 743-1010',
        'scholarship': '(713) 743-1010',
        'registrar': '(713) 743-1010',
        'registration': '(713) 743-1010',
        'health': '(713) 743-5151',
        'medical': '(713) 743-5151',
        'police': '(713) 743-3333',
        'security': '(713) 743-3333',
        'uhpd': '(713) 743-3333'
    };
    
    // Check if we have a known phone number for this query
    const normalizedQuery = query.toLowerCase().trim();
    if (knownPhones[normalizedQuery]) {
        console.log(`Using known phone number for ${normalizedQuery}: ${knownPhones[normalizedQuery]}`);
        return knownPhones[normalizedQuery];
    }
    
    // Check for partial matches in the query
    for (const [key, value] of Object.entries(knownPhones)) {
        if (normalizedQuery.includes(key)) {
            console.log(`Using known phone number for partial match ${key}: ${value}`);
            return value;
        }
    }
    
    // If no known phone number, return the provided phone
    return phone;
}

// Main search handler
ipcMain.handle('search-phone', async (event, query) => {
    try {
        // Use AI to interpret the query
        const interpretationResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: `Interpret this search query for University of Houston departments. Convert it to a standardized department name. Example: "housing" -> "Student Housing". Query: "${query}"`
                    }]
                }]
            }
        );

        const interpretedQuery = interpretationResponse.data.candidates[0].content.parts[0].text;
        console.log('Interpreted query:', interpretedQuery);

        // Search the database with the interpreted query
        const result = searchPhoneDatabase(interpretedQuery);
        
        if (result.success) {
            return result;
        } else {
            // If no match found with interpreted query, try with original query
            return searchPhoneDatabase(query);
        }
    } catch (error) {
        console.error('Search error:', error);
        return {
            success: false,
            message: 'Failed to find phone number',
            error: error.message
        };
    }
});

// Handler to add a new phone number
ipcMain.handle('add-phone', async (event, department, phoneNumber) => {
    try {
        const success = addPhoneNumber(department, phoneNumber);
        
        if (success) {
            return {
                success: true,
                message: 'Phone number added successfully'
            };
        } else {
            return {
                success: false,
                message: 'Failed to add phone number',
                error: 'Database write error'
            };
        }
    } catch (error) {
        console.error('Add phone error:', error);
        return {
            success: false,
            message: 'Failed to add phone number',
            error: error.message
        };
    }
});

// Handler to get all departments
ipcMain.handle('get-departments', async () => {
    try {
        const database = readPhoneDatabase();
        return {
            success: true,
            data: database.departments
        };
    } catch (error) {
        console.error('Get departments error:', error);
        return {
            success: false,
            message: 'Failed to get departments',
            error: error.message
        };
    }
});

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});