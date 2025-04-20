// gui.js 

let gui;
let wordTextarea;
let wordCountDisplay;

// This function initializes the lil-gui GUI and sets up listeners
function initGUI() {
    console.log("[GUI] Initializing lil-gui...");

    // --- 1. Get References to DOM Elements ---
    const guiContainer = document.getElementById('gui-container'); 
    wordTextarea = document.getElementById('word-input-textarea');
    wordCountDisplay = document.getElementById('word-count-display');

    // Check if elements exist
    if (!wordTextarea) {
        console.error("[GUI Error] Textarea element '#word-input-textarea' not found!");
    }
    if (!wordCountDisplay) {
        console.warn("[GUI Warning] Word count display element '#word-count-display' not found!");
    }

    // --- 2. Initialize lil-gui ---
    gui = new lil.GUI({ title: 'Controls' });

    if (guiContainer) {
        guiContainer.appendChild(gui.domElement);
        console.log("[GUI] Appended lil-gui to #gui-container.");
    } else {
        console.log("[GUI] No #gui-container found, lil-gui will float top-right.");
    }


    // --- 3. Text Input Area Setup ---
    if (wordTextarea) {
        console.log("[GUI] Setting up Text Area...");
        wordTextarea.value = settings.initialTextAreaContent || '';
        wordTextarea.addEventListener('input', () => {
            syncWordsWithTextarea();
            updateWordCountDisplay();
        });
        console.log("[GUI] Text Area listener attached.");

         // Initial sync on load
         console.log("[GUI] Triggering initial sync from text area content.");
         syncWordsWithTextarea();
         updateWordCountDisplay();
    }

    // --- 4. Display Settings Folder ---
    const displayFolder = gui.addFolder('Display Options');
    displayFolder.open(); // Open by default

    displayFolder.add(settings, 'showWord').name('Show Word')
        .onChange(() => { console.log("[GUI] Show Word changed."); redraw(); });

    displayFolder.add(settings, 'showColorName').name('Show Color Name')
        .onChange(() => { console.log("[GUI] Show Color Name changed."); redraw(); });

    displayFolder.add(settings, 'showColorHex').name('Show Hex Code')
        .onChange(() => { console.log("[GUI] Show Hex Code changed."); redraw(); });

    // Use addColor for color pickers in lil-gui
    displayFolder.addColor(settings, 'backgroundColor').name('Background')
        .onChange(() => { console.log("[GUI] Background Color changed."); redraw(); });


    // --- 5. Source Filtering Folder (Using Simplified Sources) ---
    const sourcesFolder = gui.addFolder('Filter Sources');
    sourcesFolder.open(); // Open by default

    const sourceGuiMapping = {
        'color_names': 'Color Names',
        'xkcd': 'XKCD Colors',
        'wikipedia': 'Wikipedia',
        'None': 'None / Other'
    };

    Object.keys(sourceGuiMapping).forEach(sourceKey => {
        if (settings.sources.hasOwnProperty(sourceKey)) {
            sourcesFolder.add(settings.sources, sourceKey).name(sourceGuiMapping[sourceKey])
                .onChange((value) => { 
                    console.log(`[GUI] Source filter changed for ${sourceKey}: ${value}`);
                    redraw();
                });
        } else {
            console.warn(`[GUI Warning] Source key "${sourceKey}" from mapping not found in sketch.js settings.sources.`);
        }
    });
    console.log("[GUI] Source filter controls added.");


    // --- 6. Actions ---
    gui.add(settings, 'savePNG').name('Save Canvas (PNG)'); 
    console.log("[GUI] Save button added.");
    console.log("[GUI] lil-gui initialization complete.");
    updateWordCountDisplay();
}

// --- 7. Word Count Display Function
function updateWordCountDisplay() {
    if (wordCountDisplay) {
        const count = typeof words !== 'undefined' ? words.length : 0;
        wordCountDisplay.innerText = count;
    }
}