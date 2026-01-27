const express = require('express')
const app = express();
const path = require('path')
const moment = require('moment')
const cookieParser = require('cookie-parser')
const { Server } = require('socket.io')
const config = require('config')
const PORT = config.get('data').port
const data = config.get('data')
const productRouter = require('./router/product')
const { checkAuth } = require('./public/js/includes/auth')

app.locals = { data }
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'public'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(cookieParser())

app.use('/product', productRouter)

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