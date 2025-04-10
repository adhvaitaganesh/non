document.addEventListener('DOMContentLoaded', function() {
    // Initialize syntax highlighting
    hljs.highlightAll();
    
    // Load contract code
    loadContractCode();
    
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding tab pane
            const contractType = this.getAttribute('data-contract');
            document.getElementById(`${contractType}-content`).classList.add('active');
        });
    });
    
    // Modal functionality
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    const viewFullFindingsBtn = document.getElementById('view-full-findings');
    
    viewFullFindingsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadMarkdownContent('findings_and_recommendations.md', 'Findings and Recommendations');
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Smooth scrolling for navigation
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            window.scrollTo({
                top: targetElement.offsetTop - 100,
                behavior: 'smooth'
            });
        });
    });
});

// Function to load contract code
async function loadContractCode() {
    try {
        // Load MixtapeRegistry code
        const registryResponse = await fetch('contracts/MixtapeRegistry.sol');
        const registryCode = await registryResponse.text();
        document.getElementById('registry-code').textContent = registryCode;
        
        // Load MixtapeAccount code
        const accountResponse = await fetch('contracts/MixtapeAccount.sol');
        const accountCode = await accountResponse.text();
        document.getElementById('account-code').textContent = accountCode;
        
        // Load EnhancedMixtapeNFT code
        const nftResponse = await fetch('contracts/EnhancedMixtapeNFT.sol');
        const nftCode = await nftResponse.text();
        document.getElementById('nft-code').textContent = nftCode;
        
        // Load MixtapeJukebox code
        const jukeboxResponse = await fetch('contracts/MixtapeJukebox.sol');
        const jukeboxCode = await jukeboxResponse.text();
        document.getElementById('jukebox-code').textContent = jukeboxCode;
        
        // Load EnhancedMixtapeSocialRegistry code
        const socialResponse = await fetch('contracts/EnhancedMixtapeSocialRegistry.sol');
        const socialCode = await socialResponse.text();
        document.getElementById('social-code').textContent = socialCode;
        
        // Re-initialize syntax highlighting
        hljs.highlightAll();
    } catch (error) {
        console.error('Error loading contract code:', error);
    }
}

// Function to load markdown content
async function loadMarkdownContent(filename, title) {
    try {
        const response = await fetch(filename);
        const markdown = await response.text();
        
        // Use a simple markdown parser or just display as pre-formatted text
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `<h2>${title}</h2><div class="markdown-content">${formatMarkdown(markdown)}</div>`;
    } catch (error) {
        console.error('Error loading markdown content:', error);
    }
}

// Simple markdown formatter
function formatMarkdown(markdown) {
    // Replace headers
    let formatted = markdown
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    
    // Replace bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace lists
    formatted = formatted.replace(/^\- (.*$)/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
    
    // Replace numbered lists
    formatted = formatted.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n)+/g, '<ol>$&</ol>');
    
    // Replace paragraphs
    formatted = formatted.replace(/^(?!<[hou]|$)(.*$)/gm, '<p>$1</p>');
    
    return formatted;
}
