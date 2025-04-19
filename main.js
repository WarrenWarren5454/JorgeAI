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
        // If there's an error, create a new database
        const initialDatabase = {
            departments: [],
            metadata: {
                last_updated: new Date().toISOString()
            }
        };
        fs.writeFileSync(phoneDatabaseFile, JSON.stringify(initialDatabase, null, 2));
        return initialDatabase;
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
function addPhoneNumber(department, phoneNumber, aliases = []) {
    const database = readPhoneDatabase();
    
    // Check if department already exists
    const existingIndex = database.departments.findIndex(dept => 
        dept.name.toLowerCase() === department.toLowerCase()
    );
    
    if (existingIndex >= 0) {
        // Update existing department
        database.departments[existingIndex].phoneNumber = phoneNumber;
        database.departments[existingIndex].lastValid = new Date().toISOString();
        
        // Add new aliases if they don't exist
        if (aliases && aliases.length > 0) {
            const existingAliases = database.departments[existingIndex].aliases || [];
            aliases.forEach(alias => {
                if (!existingAliases.includes(alias.toLowerCase())) {
                    existingAliases.push(alias.toLowerCase());
                }
            });
            database.departments[existingIndex].aliases = existingAliases;
        }
    } else {
        // Add new department
        database.departments.push({
            name: department,
            phoneNumber: phoneNumber,
            aliases: aliases || [],
            added: new Date().toISOString(),
            lastValid: new Date().toISOString()
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
        // If there's an error, create a new cache
        const initialCache = {
            cache: {},
            metadata: {
                last_updated: new Date().toISOString(),
                cache_duration_days: 30
            }
        };
        fs.writeFileSync(cacheFile, JSON.stringify(initialCache, null, 2));
        return initialCache;
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

// Function to search in cache
function searchCache(query) {
    const cache = readCache();
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check if query exists in cache
    if (cache.cache[normalizedQuery] && isCacheValid(cache.cache[normalizedQuery].lastValid)) {
        return {
            success: true,
            data: {
                department: cache.cache[normalizedQuery].department,
                phoneNumber: cache.cache[normalizedQuery].phoneNumber
            },
            source: 'cache'
        };
    }
    
    // Check aliases in cache
    for (const [key, value] of Object.entries(cache.cache)) {
        if (value.aliases && value.aliases.includes(normalizedQuery) && isCacheValid(value.lastValid)) {
            return {
                success: true,
                data: {
                    department: value.department,
                    phoneNumber: value.phoneNumber
                },
                source: 'cache'
            };
        }
    }
    
    // No match found in cache
    return {
        success: false,
        message: 'No match found in cache'
    };
}

// Function to add to cache
function addToCache(query, department, phoneNumber) {
    const cache = readCache();
    const normalizedQuery = query.toLowerCase().trim();
    
    // Add to cache
    cache.cache[normalizedQuery] = {
        department: department,
        phoneNumber: phoneNumber,
        lastValid: new Date().toISOString(),
        aliases: [normalizedQuery]
    };
    
    // Update metadata
    cache.metadata.last_updated = new Date().toISOString();
    
    // Write to file
    return writeCache(cache);
}

// Function to use AI to interpret the query
async function interpretQuery(query) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: `Convert "${query}" into the exact University of Houston department name. Respond with only the name (e.g. UH Bookstore).`
                    }]
                }]
            }
        );

        // Get the response and trim any whitespace
        const departmentName = response.data.candidates[0].content.parts[0].text.trim();
        console.log('AI interpretation result:', departmentName);
        
        return departmentName;
    } catch (error) {
        console.error('AI interpretation error:', error);
        return query; // Fall back to original query
    }
}

// Google search function
async function searchGoogle(query) {
    try {
        // Verify environment variables
        if (!process.env.GOOGLE_API_KEY) {
            console.error('GOOGLE_API_KEY is not defined in environment variables');
            return [];
        }
        
        if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.error('GOOGLE_SEARCH_ENGINE_ID is not defined in environment variables');
            return [];
        }
        
        // Construct a proper search query for the University of Houston
        const searchQuery = `${query} University of Houston phone number contact`;
        console.log('Searching Google with query:', searchQuery);
        
        // Use axios instead of fetch
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: process.env.GOOGLE_API_KEY,
                cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                q: searchQuery,
                num: 2
            }
        });
        
        if (!response.data || !response.data.items || response.data.items.length === 0) {
            console.log('No search results found');
            return [];
        }

        // Extract and return the URLs
        const urls = response.data.items.map(item => item.link);
        console.log('Found URLs:', urls);
        return urls;
    } catch (error) {
        console.error('Error in Google search:', error.message);
        if (error.response) {
            console.error('API response:', error.response.data);
        }
        return [];
    }
}

// Web scraping function
async function scrapeWebsite(url) {
    try {
        console.log(`Scraping: ${url}`);
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // First try to find phone numbers in common contact elements
        const contactElements = $('a[href^="tel:"], .contact, .phone, .telephone, [class*="contact"], [class*="phone"], [id*="contact"], [id*="phone"]');
        let phones = [];
        
        contactElements.each((i, elem) => {
            const text = $(elem).text().trim();
            const href = $(elem).attr('href');
            
            // Extract from tel: links
            if (href && href.startsWith('tel:')) {
                const phone = href.replace('tel:', '').trim();
                if (isValidPhoneNumber(phone)) {
                    phones.push(phone);
                }
            }
            
            // Extract from text content
            const phoneMatches = text.match(/(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g);
            if (phoneMatches) {
                phones.push(...phoneMatches);
            }
        });
        
        // If no phones found in contact elements, search the entire page
        if (phones.length === 0) {
            const text = $('body').text();
            const phoneMatches = text.match(/(?:\+1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g);
            if (phoneMatches) {
                phones.push(...phoneMatches);
            }
        }
        
        // Remove duplicates and normalize
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
            phones: phones
        };
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    }
}

function isValidPhoneNumber(phone) {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Check if it's a valid 10-digit phone number
    return digits.length === 10;
}

// Function to disambiguate phone numbers using AI
async function disambiguatePhoneNumbers(query, phoneNumbers, urls) {
    try {
        // First, validate all phone numbers
        const validPhoneNumbers = phoneNumbers.filter(phone => {
            // Remove any non-digit characters
            const digits = phone.replace(/\D/g, '');
            // Check if it's a valid 10-digit phone number
            return digits.length === 10;
        });

        if (validPhoneNumbers.length === 0) {
            console.log('No valid phone numbers found');
            return null;
        }

        // If we only have one valid phone number, return it
        if (validPhoneNumbers.length === 1) {
            console.log('Only one valid phone number found');
            return validPhoneNumbers[0];
        }

        // Simple disambiguation logic
        // 1. Check if any number is from the first URL (usually the most relevant)
        const firstUrlPhones = phoneNumbers.filter((phone, index) => {
            // Find which URL this phone came from
            for (let i = 0; i < urls.length; i++) {
                if (urls[i] === urls[0]) {
                    // This phone is from the first URL
                    return true;
                }
            }
            return false;
        });

        if (firstUrlPhones.length === 1) {
            console.log('Selected phone number from first URL');
            return firstUrlPhones[0];
        }

        // 2. Check for common UH area codes (713, 832)
        const uhAreaCodePhones = validPhoneNumbers.filter(phone => {
            const digits = phone.replace(/\D/g, '');
            return digits.startsWith('713') || digits.startsWith('832');
        });

        if (uhAreaCodePhones.length === 1) {
            console.log('Selected phone number with UH area code');
            return uhAreaCodePhones[0];
        }

        // 3. If we still have multiple numbers, just return the first one
        console.log('Multiple valid phone numbers found, returning the first one');
        return validPhoneNumbers[0];
    } catch (error) {
        console.error('Error in disambiguation:', error);
        return null;
    }
}

// Main search handler
ipcMain.handle('search-phone', async (event, query) => {
    try {
        console.log('Searching for:', query);
        
        // First, interpret the query using AI
        const interpretedQuery = await interpretQuery(query);
        console.log('Interpreted query:', interpretedQuery);
        
        // Check cache first
        const cachedResult = await searchCache(interpretedQuery);
        if (cachedResult && cachedResult.success) {
            console.log('Found in cache:', cachedResult);
            return {
                success: true,
                phone: cachedResult.data.phoneNumber,
                source: 'cache',
                timestamp: cachedResult.data.lastValid
            };
        }
        
        // If not in cache, search Google
        const urls = await searchGoogle(interpretedQuery);
        if (!urls || urls.length === 0) {
            console.log('No relevant pages found');
            return {
                success: false,
                error: 'No relevant pages found for your search. Please try a different search term.'
            };
        }
        
        console.log('Visiting URLs:', urls);
        
        // Scrape phone numbers from the pages
        const allPhones = [];
        for (const url of urls) {
            console.log(`Scraping URL: ${url}`);
            const result = await scrapeWebsite(url);
            if (result && result.phones) {
                console.log(`Found ${result.phones.length} phone numbers at ${url}:`, result.phones);
                allPhones.push(...result.phones);
            } else {
                console.log(`No phone numbers found at ${url}`);
            }
        }
        
        if (allPhones.length === 0) {
            console.log('No phone numbers found on pages');
            return {
                success: false,
                error: 'No phone numbers found on the searched pages. Please try a different search term.'
            };
        }
        
        // Use AI to disambiguate the phone numbers
        const disambiguatedPhone = await disambiguatePhoneNumbers(interpretedQuery, allPhones, urls);
        
        if (disambiguatedPhone === null) {
            return {
                success: false,
                error: 'Could not determine the correct phone number. Please try a more specific search term or validate the results manually.',
                allPhones: allPhones,
                urls: urls
            };
        }
        
        return {
            success: true,
            phone: disambiguatedPhone,
            source: 'web',
            urls: urls,
            allPhones: allPhones
        };
    } catch (error) {
        console.error('Search error:', error);
        return {
            success: false,
            error: 'An error occurred while searching. Please try again.'
        };
    }
});

// Handler to validate a phone number
ipcMain.handle('validate-phone', async (event, query, department, phoneNumber, isValid) => {
    try {
        if (isValid) {
            // Add to cache
            addToCache(query, department, phoneNumber);
            
            // Add to database
            addPhoneNumber(department, phoneNumber, [query]);
            
            return {
                success: true,
                message: 'Phone number validated and added to cache'
            };
        } else {
            return {
                success: true,
                message: 'Phone number marked as invalid'
            };
        }
    } catch (error) {
        console.error('Validation error:', error);
        return {
            success: false,
            message: 'Failed to validate phone number',
            error: error.message
        };
    }
});

// Handler to add a new phone number manually
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