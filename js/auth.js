// Simple authentication
function checkPassword() {
    const password = localStorage.getItem('sitePassword');
    if (!password) {
        const userPassword = prompt('Please enter the password to access this site:');
        if (userPassword === 'MRKD2025') { // Secure password for the site
            localStorage.setItem('sitePassword', userPassword);
            return true;
        } else {
            window.location.href = 'https://github.com/404';
            return false;
        }
    }
    return true;
}

// Check password when page loads
if (!checkPassword()) {
    document.body.innerHTML = 'Access Denied';
} 