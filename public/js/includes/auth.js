const axios = require('axios')
const config = require('config')
const data = config.get('data')

async function checkAuth(req, res, next) {
    const publicPaths = ['/logout', '/login', '/set-cookie', '/user/check-auth', '/favicon.ico'];
    if (publicPaths.some(p => req.path.startsWith(p))) return next();

    const emp_id = req.cookies?.emp_id;
    let accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    if (!emp_id) return res.redirect('/logout');

    try {
        // ลองเรียก API ด้วย accessToken ปัจจุบัน
        const resp = await axios.get(`${data.node_api}/user/check-auth`, {
            params: { emp_id },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (resp.status !== 200) return res.redirect('/logout');

        const body = resp.data || {};
        if (body.valid === false) return res.redirect('/logout');

        // ถ้ามี expires_at ให้เช็ค
        if (body.expires_at) {
            const expiresAt = typeof body.expires_at === 'number' ? body.expires_at : Date.parse(body.expires_at);
            if (!isNaN(expiresAt) && Date.now() > expiresAt) return res.redirect('/logout');
        }

        return next();

    } catch (err) {
        // ถ้าได้ 401 (token หมดอายุ) ให้ลอง refresh token
        if (err.response?.status === 401) {
            try {
                const refreshResp = await axios.post(`${data.node_api}/user/token`, {}, {
                    headers: {
                        'Authorization': `Bearer ${refreshToken}`
                    }
                });

                if (refreshResp.status === 200 && refreshResp.data?.accessToken) {
                    // ได้ accessToken ใหม่ -> อัปเดต cookie
                    const { accessToken } = refreshResp.data;
                    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });

                    // ถ้ามี refreshToken ใหม่ด้วยให้อัปเดต
                    if (refreshResp.data.refreshToken) {
                        res.cookie('refreshToken', refreshResp.data.refreshToken, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
                    }

                    // ลองเรียก check-auth อีกครั้งด้วย token ใหม่
                    const retryResp = await axios.get(`${data.node_api}/user/check-auth`, {
                        params: { emp_id },
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });

                    if (retryResp.status === 200 && retryResp.data?.valid !== false) {
                        return next();
                    }
                }
            } catch (refreshErr) {
                // refresh token ล้มเหลว -> logout
                console.error('Refresh token failed:', refreshErr.message);
            }
        }

        // ถ้า refresh ไม่ได้หรือเกิด error อื่น -> redirect logout
        return res.redirect('/logout');
    }
}

module.exports = { checkAuth };