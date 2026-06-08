require('dotenv').config()
const express = require('express')
const app = express();
const path = require('path')
const moment = require('moment')
const cookieParser = require('cookie-parser')
const { Server } = require('socket.io')
const config = require('config')
const axios = require('axios')
const PORT = config.get('data').port
const data = config.get('data')
const productRouter = require('./router/product')
const aiRouter = require('./router/ai')
const { checkAuth } = require('./public/js/includes/auth')

const PROD_API = 'http://192.168.5.32:4010'

app.locals = { data }
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'public'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(cookieParser())

app.use('/product', productRouter)
app.use('/ai', checkAuth, aiRouter)

// Mock auth for local dev — no external service needed
app.post('/user/login', (req, res) => {
	const { username, password } = req.body || {}
	if (username === 'Admin' && password === 'Admin1234') {
		const token = 'test.' + Date.now()
		const roles = [{ user_group_id: 1, sale_group_id: null, enable_price_check: 1, is_super_admin: 0, authorized: 1 }]
		const data = [{ emp_id: 'Admin', emp_name: 'Admin' }]
		return res.json({
			success: true, isPassed: 1, accessToken: token, refreshToken: token, roles, data,
			user: { username: 'Admin', isPassed: 1, roles, data }
		})
	}
	res.json({ success: false, isPassed: 0, message: 'username หรือ password ไม่ถูกต้อง' })
})
app.get('/user/check-auth', (_req, res) => {
	res.json({ valid: true, expires_at: Date.now() + 24 * 3600 * 1000 })
})
app.post('/user/token', (_req, res) => {
	res.json({ accessToken: 'test.' + Date.now() })
})

// Proxy data endpoints to production (API calls only, not page renders)
app.use(['/estimate/list', '/estimate/master_data', '/estimate/save_rfq', '/estimate/get_rfq', '/estimate/delete_rfq', '/customer', '/user/ae', '/user/qt_approver'], async (req, res) => {
	try {
		const url = PROD_API + req.originalUrl
		const resp = await axios({ method: req.method, url, data: req.body, timeout: 8000 })
		res.json(resp.data)
	} catch (e) {
		console.error('proxy error:', req.originalUrl, e.message)
		res.json({ success: true, data: [] })
	}
})

app.get('/login', (req, res) => {
	res.render('login')
})

app.get('/logout', (req, res) => {
	res.clearCookie('emp_id')
	res.clearCookie('accessToken')
	res.clearCookie('refreshToken')
	res.render('logout')
})

app.post('/set-cookie', express.urlencoded({ extended: true }), async (req, res) => {
	const emp_id = req?.body?.emp_id
	const accessToken = req?.body?.accessToken
	const refreshToken = req?.body?.refreshToken

	// เก็บ tokens ใน httpOnly cookies เพื่อความปลอดภัย
	res.cookie('emp_id', emp_id, { httpOnly: true, maxAge: 24 * 3600 * 1000 })
	res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 }) // 15 นาที
	res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 }) // 7 วัน

	return res.status(200).json({ success: true, message: 'Cookie set successfully' })
})

app.get('/about', (req, res) => {
	res.render('quote')
})
app.get('/view', checkAuth, (req, res) => {
	res.render('estimate')
})
app.get('/estimate', checkAuth, (req, res) => {
	res.render('estimate')
})

app.post('/print2', (req, res) => {
	// Retrieve the data from the request body
	const data = req.body;

	// Render the EJS file and pass the data as a variable
	res.render('estimate_print', { data });
});


app.post('/print', (req, res) => {
	const base64Data = req.body.data; // Retrieve the base64 data from the request body

	// Decode the base64 data back to the original array
	const data = JSON.parse(atob(base64Data));

	res.render('estimate_print', { data });
})

app.get('/quote', checkAuth, (req, res) => {
	res.render('quote')
})

app.get('/quote/new', checkAuth, (req, res) => {
	res.render('quote_detail', { moment: moment })
})

app.get('/quote/view', checkAuth, (req, res) => {
	res.render('quote_detail', { moment: moment })
})

app.get('/quote/edit', checkAuth, (req, res) => {
	res.render('quote_detail', { moment: moment })
})

app.get('/quote/print', checkAuth, (req, res) => {
	res.render('quote_print')
})

app.get('/quote_print', checkAuth, (req, res) => {
	res.render('quote_print')
})



app.get('/id/:id', checkAuth, (req, res) => {
	res.json({ id: req.params.id })
})

app.post('/add', checkAuth, (req, res) => {
	res.json({ sucess: true, message: req.body.message })
})

app.get('/', checkAuth, (req, res) => {
	res.render('index')
})

app.use((req, res, next) => {
	const error = new Error('Not Found');
	error.status = 404;
	res.status(404).send('Not Found');
});


const server = app.listen(PORT, () => {
	console.log(`Server is running on ${PORT}`)
})

const io = new Server(server);

io.on("connection", (socket) => {
	console.log(socket.id + ' is connecting')
	socket.on("disconnect", () => {
		console.log('socket.io disconnect')
	})

	socket.on("save_message", (data) => {
		io.emit("refresh_message", data);
	})
})