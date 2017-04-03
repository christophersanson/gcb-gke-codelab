const getWelcomeMsg = require('../lib/get-welcome-message')

module.exports = (req, res) => {
    const welcomeMsg = getWelcomeMsg()
    return res.json(welcomeMsg)
}
