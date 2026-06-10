// Axios interceptor สำหรับจัดการ JWT token ฝั่ง client
// ใช้สำหรับ AJAX requests ที่ต้องการ authentication

(function () {
    // ตัวแปรสำหรับเก็บสถานะการ refresh
    let isRefreshing = false;
    let refreshSubscribers = [];

    // ฟังก์ชันสำหรับแจ้ง subscribers เมื่อ refresh เสร็จ
    function onRefreshed(token) {
        refreshSubscribers.map(callback => callback(token));
        refreshSubscribers = [];
    }

    // ฟังก์ชันสำหรับเพิ่ม subscriber
    function addRefreshSubscriber(callback) {
        refreshSubscribers.push(callback);
    }

    // Request Interceptor - แนบ token ทุก request (ถ้ามี)
    if (typeof axios !== 'undefined') {
        axios.interceptors.request.use(
            function (config) {
                // ไม่ต้องแนบ token สำหรับ public endpoints
                const publicEndpoints = ['/user/login', '/user/token', '/set-cookie'];
                const isPublic = publicEndpoints.some(endpoint => config.url.includes(endpoint));

                if (!isPublic) {
                    // อ่าน token จาก localStorage หรือที่เก็บอื่น ๆ
                    // เนื่องจากใช้ httpOnly cookie token จะถูกส่งอัตโนมัติ
                    // แต่ถ้าต้องการแนบเองสำหรับ API calls:
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                        config.headers['Authorization'] = `Bearer ${token}`;
                    }
                }

                return config;
            },
            function (error) {
                return Promise.reject(error);
            }
        );

        // Response Interceptor - จัดการ token หมดอายุ
        axios.interceptors.response.use(
            function (response) {
                // ถ้า response สำเร็จให้ return ตามปกติ
                return response;
            },
            async function (error) {
                const originalRequest = error.config;

                // ถ้าได้ 401 และยังไม่เคย retry
                if (error.response?.status === 401 && !originalRequest._retry) {

                    if (isRefreshing) {
                        // ถ้ากำลัง refresh อยู่ ให้รอ
                        return new Promise(function (resolve) {
                            addRefreshSubscriber(function (token) {
                                originalRequest.headers['Authorization'] = 'Bearer ' + token;
                                resolve(axios(originalRequest));
                            });
                        });
                    }

                    originalRequest._retry = true;
                    isRefreshing = true;

                    try {
                        // เรียก API refresh token
                        const refreshToken = localStorage.getItem('refreshToken');

                        if (!refreshToken) {
                            // ไม่มี refresh token -> logout
                            window.location.href = '/logout';
                            return Promise.reject(error);
                        }

                        const response = await axios.post(`${node_api}/user/token`, {
                            refreshToken: refreshToken
                        });

                        if (response.data?.accessToken) {
                            const newAccessToken = response.data.accessToken;

                            // เก็บ token ใหม่
                            localStorage.setItem('accessToken', newAccessToken);

                            if (response.data.refreshToken) {
                                localStorage.setItem('refreshToken', response.data.refreshToken);
                            }

                            // อัปเดต cookie ผ่าน API
                            await fetch('/set-cookie', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: new URLSearchParams({
                                    emp_id: JSON.parse(localStorage.getItem('data') || '{}').emp_id,
                                    accessToken: newAccessToken,
                                    refreshToken: response.data.refreshToken || refreshToken
                                })
                            });

                            // แจ้ง subscribers
                            isRefreshing = false;
                            onRefreshed(newAccessToken);

                            // retry original request
                            originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
                            return axios(originalRequest);
                        }
                    } catch (refreshError) {
                        isRefreshing = false;
                        console.error('Refresh token failed:', refreshError);

                        // Refresh ไม่สำเร็จ -> logout
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        localStorage.removeItem('data');
                        window.location.href = '/logout';

                        return Promise.reject(refreshError);
                    }
                }

                // ถ้าไม่ใช่ 401 หรือ retry ไม่สำเร็จ
                if (error.response?.status === 401) {
                    window.location.href = '/logout';
                }

                return Promise.reject(error);
            }
        );

        console.log('Auth interceptor initialized');
    }
})();
