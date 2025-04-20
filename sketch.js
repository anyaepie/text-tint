// sketch.js

// --- Global Variables & Constants ---
const canvasSize = 600;
const MAX_WORDS = 100;
const CELL_MARGIN = 4;
const MIN_FONT_SIZE = 6;

const CLOUD_FUNCTION_URL = "https://find-color-function-914020612718.europe-west2.run.app";
console.log(`[Config] Cloud Function URL set to: ${CLOUD_FUNCTION_URL}`);

// Define the ALLOWED sources for *using* results during fetch
const ALLOWED_FETCH_SOURCES = new Set(['color_names', 'xkcd', 'wikipedia']);
console.log(`[Config] Allowed fetch sources:`, ALLOWED_FETCH_SOURCES);

class Word {
    constructor(text, hexColor, source, colorName, score) {
        this.text = text;
        this.hexColor = hexColor || '#cccccc'; // Default gray if null/undefined
        this.source = source || 'Unknown';   // Default source (will map to 'None' toggle)
        this.colorName = colorName || 'Default';
        this.score = score !== undefined ? score : -1;
        this.isLoading = false;
    }
}

let words = [];
console.log("[Init] Global 'words' array initialized.");

const settings = {
    sources: {
        color_names: true, // Checkbox for 'color_names' source
        xkcd: true,        // Checkbox for 'xkcd' source
        wikipedia: true,   // Checkbox for 'wikipedia' source
        None: true         // Checkbox for 'None' and ALL OTHER states (Error, Fetching, Unknown etc.)
    },
    showWord: true,
    showColorName: false,
    showColorHex: false,
    backgroundColor: "#000000",
    wordInput: '',
    initialTextAreaContent: 'Work is not always required. There is such a thing as sacred idleness - George MacDonald',
    savePNG: function() {
        console.log("[Action] savePNG called.");
        saveCanvas('word_color_grid', 'png');
    }
};
console.log("[Init] Global 'settings' object initialized (SIMPLIFIED for GUI).");

// --- Fetch and Create Word Object (Remains the same as previous version) ---
async function fetchAndCreateWordObject(text) {
    const fetchStartTime = millis();
    try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text })
        });
        const fetchDuration = millis() - fetchStartTime;

        if (!response.ok) {
            console.error(`[Fetch Error] HTTP error for "${text}": ${response.status} ${response.statusText}`);
            const errorBody = await response.text().catch(() => "Could not read error body");
            console.error(`[Fetch Error Body] for "${text}": ${errorBody}`);
            return new Word(text, '#FF0000', 'Error', `HTTP ${response.status}`, -1);
        }

        let responseData;
        try {
            responseData = await response.json();
        } catch (parseError) {
             console.error(`[Fetch Error] JSON parsing failed for "${text}":`, parseError);
             try {
                 const rawBodyForError = await response.text();
                 console.error(`[Fetch Error] Raw body on parse fail was: ${rawBodyForError}`);
             } catch (e) {/* ignore */}
             return new Word(text, '#FF4500', 'Error', 'JSON Parse Err', -1);
        }

        // --- Source Filtering Logic ---
        let foundMatch = null;
        if (responseData && Array.isArray(responseData.results) && responseData.results.length > 0) {
            for (const hit of responseData.results) {
                if (hit && hit.payload && hit.payload.source && ALLOWED_FETCH_SOURCES.has(hit.payload.source)) {
                    if (hit.payload.name && hit.payload.hex) {
                        foundMatch = hit;
                        break;
                    } else {
                         console.warn(`[Fetch Filter Warning] Allowed source "${hit.payload.source}" found, but payload missing name/hex for "${text}". Skipping.`);
                    }
                }
            }
        }

        // --- Process the found match or fallback ---
        if (foundMatch) {
             return new Word(
                 text,
                 foundMatch.payload.hex,
                 foundMatch.payload.source,
                 foundMatch.payload.name,
                 foundMatch.score
             );
        } else {
            // Assign 'None' source - will map to 'None' toggle in drawGrid
            return new Word(text, '#444444', 'None', 'Not Found', -1);
        }

    } catch (error) {
        const fetchDuration = millis() - fetchStartTime;
        console.error(`[Fetch Error] Network/Fetch or processing failed for "${text}" after ${fetchDuration.toFixed(0)}ms:`, error);
        // Assign 'Error' source - will map to 'None' toggle in drawGrid
        return new Word(text, '#FF8C00', 'Error', 'Network Err', -1);
    }
}

// --- P5.js Core Functions ---

function setup() {
    console.log("[Setup] p5 setup() started.");
    const canvas = createCanvas(canvasSize, canvasSize);
    canvas.parent('canvas-container');
    console.log("[Setup] Canvas created and parented.");
    textAlign(CENTER, CENTER);
    noLoop(); // IMPORTANT: draw() only runs when redraw() is called
    console.log("[Setup] textAlign set, noLoop() activated.");
    if (typeof initGUI === "function") {
        console.log("[Setup] Calling initGUI()...");
        initGUI();
        console.log("[Setup] initGUI() finished.");
    } else {
        console.error("[Setup Error] initGUI function not found!");
    }
    console.log("[Setup] p5 setup() finished. Initial draw might be triggered by initGUI's sync.");
}

function draw() {
    const drawStartTime = millis();
    background(settings.backgroundColor);
    const displayCount = words.length;
    const gridSize = calculateGridSize(displayCount);
    drawGrid(words, gridSize);
    const drawDuration = millis() - drawStartTime;
     if(drawDuration > 10) {
         console.log(`[Draw] p5 draw() finished in ${drawDuration.toFixed(1)}ms.`);
     }
}

// --- Core Synchronization Logic  ---
let isSyncing = false;
async function syncWordsWithTextarea() {
    if (isSyncing) return;
    isSyncing = true;
    // console.log(`[Sync] Syncing...`); // Less noisy

    if (typeof wordTextarea === 'undefined' || !wordTextarea) {
        console.error("[Sync Error] wordTextarea not defined."); isSyncing = false; return;
    }

    const currentText = wordTextarea.value;
    const textareaWordsRaw = currentText.trim().split(/[\s\n]+/).filter(w => w.length > 0);
    const wordsToProcess = textareaWordsRaw.slice(0, MAX_WORDS);

    const oldWordsMap = new Map();
    words.forEach((word) => { if (word && word.text) oldWordsMap.set(word.text, { word }); });

    const promises = [];
    const reusedOrPendingWords = [];
    const newWordsToFetch = [];

    for (const currentTextWord of wordsToProcess) {
        if (oldWordsMap.has(currentTextWord)) {
            reusedOrPendingWords.push(oldWordsMap.get(currentTextWord).word);
            oldWordsMap.delete(currentTextWord);
        } else {
            const placeholderWord = new Word(currentTextWord, '#555555', 'Fetching', '...', -1);
            placeholderWord.isLoading = true;
            reusedOrPendingWords.push(placeholderWord);
            newWordsToFetch.push(currentTextWord);
        }
    }

    newWordsToFetch.forEach(textToFetch => promises.push(fetchAndCreateWordObject(textToFetch)));
    if (promises.length > 0) console.log(`[Sync] ${promises.length} fetch operations initiated.`);

    // --- Intermediate Update & Redraw ---
    let structureChanged = false;
    if (words.length !== reusedOrPendingWords.length) structureChanged = true;
    else {
     for (let i = 0; i < words.length; i++) {
        if (!words[i] || !reusedOrPendingWords[i] || words[i].text !== reusedOrPendingWords[i].text || words[i].isLoading !== reusedOrPendingWords[i].isLoading) {
           structureChanged = true; break;
        }
     }
    }
    if (structureChanged) {
     words = reusedOrPendingWords;
     console.log(`%c[Sync] Intermediate update. Requesting redraw...`, "color: orange;");
     if (typeof updateWordCountDisplay === 'function') updateWordCountDisplay();
     redraw();
    }

    // --- Wait for Fetches and Final Update ---
    if (promises.length > 0) {
     try {
        const fetchedWordObjects = await Promise.all(promises);
        const finalUpdatedWords = [];
        let fetchedIndex = 0;
        for (const wordOrPlaceholder of words) {
           if (wordOrPlaceholder.isLoading === true && wordOrPlaceholder.source === 'Fetching') {
              if (fetchedIndex < fetchedWordObjects.length) {
                 finalUpdatedWords.push(fetchedWordObjects[fetchedIndex++]);
              } else {
                 console.error(`[Sync Error] Mismatch replacing placeholder.`);
                 finalUpdatedWords.push(wordOrPlaceholder); // Keep placeholder on error
              }
           } else {
              finalUpdatedWords.push(wordOrPlaceholder);
           }
        }

        // --- Final Check for Changes ---
        let finalChange = false;
        if (words.length !== finalUpdatedWords.length) finalChange = true;
        else {
           for (let i = 0; i < words.length; i++) {
              if (!words[i] || !finalUpdatedWords[i] || words[i].isLoading !== finalUpdatedWords[i].isLoading || words[i].hexColor !== finalUpdatedWords[i].hexColor || words[i].source !== finalUpdatedWords[i].source) {
                 finalChange = true; break;
              }
           }
        }
        if (finalChange) {
           words = finalUpdatedWords;
           console.log(`%c[Sync] Fetches complete. Requesting final redraw...`, "color: green; font-weight: bold;");
           if (typeof updateWordCountDisplay === 'function') updateWordCountDisplay();
           redraw();
        }
     } catch (error) {
        console.error(`[Sync Error] During Promise.all or final update:`, error);
     }
    }
    isSyncing = false;
}


// --- Drawing Helper Functions ---

function calculateGridSize(wordCount) {
    if (wordCount <= 0) return 1;
    return Math.max(1, Math.ceil(Math.sqrt(wordCount)));
}

// --- UPDATED drawGrid function ---
function drawGrid(wordsToDraw, gridSize) {
    const cellSize = canvasSize / gridSize;
    for (let i = 0; i < wordsToDraw.length; i++) {
        const word = wordsToDraw[i];
        if (!word || typeof word.source === 'undefined') {
             continue; // Skip invalid words
        }

        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        const x = col * cellSize;
        const y = row * cellSize;

        const sourceKey = word.source;
        let isVisible = false; // Default to hidden/background color

        // Check if the source is one of the explicitly controlled *color* sources
        if (sourceKey === 'color_names' || sourceKey === 'xkcd' || sourceKey === 'wikipedia') {
            // Check if the toggle for this specific source is enabled in settings
             if (settings.sources.hasOwnProperty(sourceKey)) { // Safety check
                 isVisible = settings.sources[sourceKey] === true;
            }
        } else {
            // Source is 'None', 'Error', 'Fetching', 'Unknown', or anything else.
            // Visibility of these is controlled *only* by the 'None' toggle in settings.
             if (settings.sources.hasOwnProperty('None')) { // Safety check
                 isVisible = settings.sources.None === true;
            }
        }

        // Draw background color (either specific color or main background)
        fill(isVisible ? word.hexColor : settings.backgroundColor);
        noStroke();
        rect(x, y, cellSize, cellSize);

        // Render text (function calculates contrast and handles layout)
        // Pass 'isVisible' to indicate if the text should contrast with the word color or background color
        renderWordText(word, x, y, cellSize, isVisible);
    }
}

// --- renderWordText (Remains the same, uses the 'useWordColor' flag passed by drawGrid) ---
function renderWordText(word, x, y, cellSize, useWordColor) {
    const showWord = settings.showWord;
    const showName = settings.showColorName;
    const showHex = settings.showColorHex;

    if ((!showWord && !showName && !showHex) || !word) return;

    // Determine text color based on contrast with the cell's actual background
    const actualBackground = useWordColor ? word.hexColor : settings.backgroundColor;
    const textColor = getContrastColor(actualBackground);
    fill(textColor);

    const centerX = x + cellSize / 2;
    const centerY = y + cellSize / 2;

    if (word.isLoading === true) {
         const loadingSize = max(MIN_FONT_SIZE, cellSize * 0.2);
         textSize(loadingSize);
         text('...', centerX, centerY);
         return;
    }

    const availableWidth = max(0, cellSize - CELL_MARGIN * 2);
    const availableHeight = max(0, cellSize - CELL_MARGIN * 2);
    if (availableWidth <= 1 || availableHeight < MIN_FONT_SIZE) return;

    const lines = [];
    if (showWord && word.text) lines.push(word.text);
    if (showName && word.colorName) lines.push(`(${word.colorName})`);
    if (showHex && word.hexColor) lines.push(word.hexColor);
    const numLines = lines.length;
    if (numLines === 0) return;

    // --- Smart Font Size Calculation ---
    let heightPerLineFactor = 0.85;
    if (numLines === 2) heightPerLineFactor = 0.45;
    if (numLines === 3) heightPerLineFactor = 0.30;
    let baseSize = max(MIN_FONT_SIZE, min(availableHeight * heightPerLineFactor, availableWidth * 0.8));
    let finalSizes = lines.map(() => baseSize);
    let longestString = lines.reduce((a, b) => (a && b && a.length > b.length) ? a : b, "");
    if (longestString) {
        textSize(baseSize);
        while (textWidth(longestString) > availableWidth && baseSize > MIN_FONT_SIZE) { baseSize -= 0.5; textSize(baseSize); }
        baseSize = max(baseSize, MIN_FONT_SIZE);
        finalSizes = lines.map(() => baseSize);
    }
    if (numLines > 1 && finalSizes.length > 1) finalSizes[1] = max(MIN_FONT_SIZE, finalSizes[1] * 0.9);
    if (numLines > 2 && finalSizes.length > 2) finalSizes[2] = max(MIN_FONT_SIZE, finalSizes[2] * 0.8);

    // --- Vertical Layout ---
    let totalTextHeight = finalSizes.reduce((sum, size) => sum + size * 1.15, 0);
    if (totalTextHeight > availableHeight && totalTextHeight > 0) {
        const scale = availableHeight / totalTextHeight;
        finalSizes = finalSizes.map(s => max(MIN_FONT_SIZE, s * scale));
        totalTextHeight = finalSizes.reduce((sum, size) => sum + size * 1.15, 0);
    }
    let currentY = centerY - totalTextHeight / 2;

    // --- Draw Lines ---
    lines.forEach((line, index) => {
        if (index < finalSizes.length) {
            const currentSize = finalSizes[index];
            textSize(currentSize);
            text(line, centerX, currentY + currentSize * 0.5); // Center baseline
            currentY += currentSize * 1.15;
        }
    });
}


// --- Utility Functions (getContrastColor remains the same) ---
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#') || hexColor.length < 4) return "#FFFFFF";
    try {
        let fullHex = hexColor;
        if (hexColor.length === 4) fullHex = '#' + hexColor[1]+hexColor[1]+hexColor[2]+hexColor[2]+hexColor[3]+hexColor[3];
        if(fullHex.length !== 7) return "#FFFFFF";
        const r=parseInt(fullHex.slice(1,3),16), g=parseInt(fullHex.slice(3,5),16), b=parseInt(fullHex.slice(5,7),16);
        if(isNaN(r)||isNaN(g)||isNaN(b)) return "#FFFFFF";
        const l=(0.299*r+0.587*g+0.114*b)/255;
        return l > 0.5 ? "#000000" : "#FFFFFF";
    } catch (e) { console.error(`[Contrast Error] Failed processing hex '${hexColor}'`, e); return "#FFFFFF"; }
}

