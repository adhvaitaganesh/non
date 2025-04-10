// Interactive elements for the Music Jukebox dApp website
document.addEventListener('DOMContentLoaded', function() {
    // Add interactive architecture diagram
    initArchitectureDiagram();
    
    // Add contract documentation link
    addDocumentationLink();
    
    // Add scroll animations
    initScrollAnimations();
    
    // Add interactive code examples
    initCodeExamples();
});

// Function to make the architecture diagram interactive
function initArchitectureDiagram() {
    const diagramBoxes = document.querySelectorAll('.diagram-box');
    
    diagramBoxes.forEach(box => {
        box.addEventListener('mouseenter', function() {
            // Add a class to highlight the current box
            this.classList.add('highlight');
            
            // Get the contract type from the heading
            const contractType = this.querySelector('h3').textContent.toLowerCase().replace('mixtape', '').trim();
            
            // Show a tooltip with more information
            const tooltip = document.createElement('div');
            tooltip.className = 'diagram-tooltip';
            tooltip.innerHTML = getContractDescription(contractType);
            this.appendChild(tooltip);
        });
        
        box.addEventListener('mouseleave', function() {
            // Remove the highlight class
            this.classList.remove('highlight');
            
            // Remove the tooltip
            const tooltip = this.querySelector('.diagram-tooltip');
            if (tooltip) {
                this.removeChild(tooltip);
            }
        });
        
        // Make boxes clickable to navigate to contract tabs
        box.addEventListener('click', function() {
            const contractType = this.querySelector('h3').textContent.toLowerCase().replace('mixtape', '').trim();
            
            // Scroll to contracts section
            document.getElementById('contracts').scrollIntoView({ behavior: 'smooth' });
            
            // Activate the corresponding tab
            setTimeout(() => {
                const tabButton = document.querySelector(`.tab-button[data-contract="${contractType}"]`);
                if (tabButton) {
                    tabButton.click();
                }
            }, 500);
        });
    });
}

// Function to get contract descriptions for tooltips
function getContractDescription(contractType) {
    const descriptions = {
        'registry': 'Creates and manages token bound accounts for NFTs following the ERC-6551 standard.',
        'account': 'Implementation for token bound accounts with rights management capabilities.',
        'nft': 'ERC-721 tokens representing music tracks with TBA creation and pay-to-play functionality.',
        'jukebox': 'Mother account managing platform fees, play history, and user interactions.',
        'social registry': 'Manages social interactions like likes and comments for mixtape TBAs.'
    };
    
    return descriptions[contractType] || 'No description available';
}

// Function to add documentation link
function addDocumentationLink() {
    const nav = document.querySelector('nav ul');
    
    if (nav) {
        const docLi = document.createElement('li');
        const docLink = document.createElement('a');
        docLink.href = 'documentation.html';
        docLink.textContent = 'Documentation';
        docLi.appendChild(docLink);
        nav.appendChild(docLi);
    }
}

// Function to initialize scroll animations
function initScrollAnimations() {
    // Get all sections
    const sections = document.querySelectorAll('.section');
    
    // Create an Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, { threshold: 0.1 });
    
    // Observe each section
    sections.forEach(section => {
        observer.observe(section);
    });
}

// Function to initialize interactive code examples
function initCodeExamples() {
    // Add copy button to code blocks
    document.querySelectorAll('.code-container').forEach(container => {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = 'Copy';
        copyButton.addEventListener('click', function() {
            const code = container.querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                copyButton.innerHTML = 'Copied!';
                setTimeout(() => {
                    copyButton.innerHTML = 'Copy';
                }, 2000);
            });
        });
        container.appendChild(copyButton);
    });
    
    // Add line numbers to code blocks
    document.querySelectorAll('pre code').forEach(block => {
        const lines = block.innerHTML.split('\n');
        let numberedLines = '';
        
        lines.forEach((line, index) => {
            numberedLines += `<span class="line-number">${index + 1}</span>${line}\n`;
        });
        
        block.innerHTML = numberedLines;
    });
}

// Add a simple animation for the music icon
setInterval(() => {
    const musicIcon = document.querySelector('.music-icon');
    if (musicIcon) {
        musicIcon.classList.add('pulse');
        setTimeout(() => {
            musicIcon.classList.remove('pulse');
        }, 1000);
    }
}, 3000);
