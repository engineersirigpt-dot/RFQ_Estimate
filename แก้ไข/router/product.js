const Router = require('express').Router()

Router.get('/',(req, res)=>{
	res.render('product')
})

module.exports = Router;