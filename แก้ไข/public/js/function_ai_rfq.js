// Handles "Add New RFQ with AI" modal on the index page.
// Sends pasted text + uploaded files to /ai/parse-spec, stores result in
// sessionStorage under 'ai_rfq_data', then redirects to /estimate?ai=1
// where function_ai_rfq_fill.js takes over to populate the form.

$(function () {
	const $modal = $('#ai-rfq-modal')
	const $textarea = $('#ai-rfq-text')
	const $fileInput = $('#ai-rfq-files')
	const $fileList = $('#ai-file-list')
	const $error = $('#ai-error')
	const $loading = $('#ai-loading')
	const $submit = $('#ai-submit-btn')
	const $dropZone = $('#ai-drop-zone')

	let pendingFiles = []

	function openModal() {
		$textarea.val('')
		pendingFiles = []
		renderFileList()
		$error.hide().text('')
		$modal.show()
	}
	function closeModal() {
		$modal.hide()
		$loading.hide()
		$submit.prop('disabled', false)
	}
	function renderFileList() {
		$fileList.empty()
		pendingFiles.forEach((f, i) => {
			const sizeKb = (f.size / 1024).toFixed(1)
			$fileList.append(
				`<li><span><i class="fa fa-file-o"></i> ${escapeHtml(f.name)} <span style="color:#888">(${sizeKb} KB)</span></span><span class="ai-remove-file" data-i="${i}">&times;</span></li>`
			)
		})
	}
	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
	}
	function showError(msg) {
		$error.text(msg).show()
	}
	function addFiles(fileListLike) {
		for (const f of fileListLike) {
			if (f.size > 25 * 1024 * 1024) {
				showError('ไฟล์ ' + f.name + ' ใหญ่เกิน 25MB')
				continue
			}
			pendingFiles.push(f)
		}
		renderFileList()
	}

	$('body').on('click', '#newRFQ-ai', openModal)
	$('#ai-modal-close, #ai-cancel-btn').on('click', closeModal)
	$modal.on('click', function (e) {
		if (e.target === this) closeModal()
	})

	// Use native .click() (not jQuery .trigger) so the browser treats it as a
	// real user gesture and opens the file picker.
	$('#ai-pick-files').on('click', (e) => {
		e.stopPropagation()
		$fileInput[0].click()
	})
	$dropZone.on('click', (e) => {
		// Don't double-fire when the inner "เลือกไฟล์" span is clicked.
		if (e.target.id === 'ai-pick-files') return
		$fileInput[0].click()
	})
	$fileInput.on('change', function () {
		addFiles(this.files)
		this.value = ''
	})

	$dropZone.on('dragover', function (e) {
		e.preventDefault()
		$(this).addClass('dragover')
	})
	$dropZone.on('dragleave drop', function (e) {
		e.preventDefault()
		$(this).removeClass('dragover')
	})
	$dropZone.on('drop', function (e) {
		const files = e.originalEvent.dataTransfer.files
		if (files && files.length) addFiles(files)
	})

	$fileList.on('click', '.ai-remove-file', function () {
		const i = parseInt($(this).attr('data-i'))
		pendingFiles.splice(i, 1)
		renderFileList()
	})

	$submit.on('click', async () => {
		const text = $textarea.val().trim()
		if (!text && pendingFiles.length === 0) {
			showError('ต้องวางข้อความหรืออัพโหลดไฟล์อย่างน้อย 1 อย่าง')
			return
		}
		$error.hide()
		$submit.prop('disabled', true)
		$loading.show()

		const fd = new FormData()
		fd.append('text', text)
		pendingFiles.forEach((f) => fd.append('files', f, f.name))

		try {
			const res = await fetch('/ai/parse-spec', { method: 'POST', body: fd, credentials: 'same-origin' })
			const json = await res.json()
			if (!json.success) {
				showError('AI ไม่สามารถอ่านข้อมูลได้: ' + (json.error || 'unknown') + (json.raw ? '\n\n' + json.raw : ''))
				$loading.hide()
				$submit.prop('disabled', false)
				return
			}
			sessionStorage.setItem('ai_rfq_data', JSON.stringify(json.data))
			sessionStorage.setItem(
				'ai_rfq_input',
				JSON.stringify({ text, files: pendingFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })) })
			)
			window.location = '/estimate?ai=1'
		} catch (err) {
			showError('เกิดข้อผิดพลาด: ' + err.message)
			$loading.hide()
			$submit.prop('disabled', false)
		}
	})
})
