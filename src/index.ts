// index.ts - Evermiss 딥링크 서비스 (수정된 버전)

// 타입 정의
interface DeviceInfo {
	type: 'android' | 'ios' | 'desktop';
	isInApp: boolean;
	userAgent: string;
	browser?: string;
	version?: string;
}

interface AppConfig {
	android: {
		package: string;
		scheme: string;
		playStoreUrl: string;
		appLink: string;
		intentUrl: string;
	};
	ios: {
		bundleId: string;
		scheme: string;
		appStoreUrl: string;
		universalLink: string;
		customScheme: string;
	};
	web: {
		fallbackUrl: string;
	};
}

// 환경 변수 인터페이스
export interface Env {
	SHA_256: string;
	ENVIRONMENT?: string;
	APP_VERSION?: string;
	DOMAIN?: string;
	API_URL?: string;
}

// 메인 fetch 핸들러
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// CORS 처리
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		};

		// OPTIONS 요청 처리
		if (method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// 라우팅
		try {
			// 헬스체크
			if (path === '/health') {
				return new Response(JSON.stringify({
					status: 'ok',
					timestamp: new Date().toISOString(),
					environment: env.ENVIRONMENT || 'development',
					domain: env.DOMAIN || 'evermiss.co.kr'
				}), {
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}

			// 디바이스 감지
			const deviceInfo = detectDevice(request.headers.get('user-agent') || '');
			const appConfig = getAppConfig(env);

			console.log("@@@@@@path", path);

			// 개인 추모관 딥링크
			if (path.startsWith('/memorial/') || path.startsWith('/m/')) {
				return handlePrivateMemorialDeeplink(request, deviceInfo, appConfig);
			}

			// 공인 추모관 딥링크
			if (path.startsWith('/celebrity/') || path.startsWith('/c/')) {
				return handlePublicMemorialDeeplink(request, deviceInfo, appConfig);
			}

			// 초대 링크
			if (path.startsWith('/invite')) {
				return handleInviteDeeplink(request, deviceInfo, appConfig);
			}

			// 공유 링크
			if (path.startsWith('/share/')) {
				return handleShareDeeplink(request, deviceInfo, appConfig);
			}

			// 기본 페이지
			if (path === '/') {
				return new Response(generateHomePage(env), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			// 404
			return new Response('Not Found', { status: 404 });

		} catch (error) {
			console.error('Error:', error);
			return new Response(JSON.stringify({
				error: 'Internal Server Error',
				message: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}
	}
};

// 디바이스 감지 함수
function detectDevice(userAgent: string): DeviceInfo {
	const ua = userAgent.toLowerCase();

	const isAndroid = /android/i.test(ua);
	const isIOS = /iphone|ipad|ipod/i.test(ua);
	const isDesktop = !isAndroid && !isIOS;

	// 브라우저 감지
	let browser = 'unknown';
	if (ua.includes('samsung')) browser = 'samsung';
	else if (ua.includes('chrome')) browser = 'chrome';
	else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'safari';
	else if (ua.includes('firefox')) browser = 'firefox';

	// 인앱 브라우저 감지
	const isInApp = ua.includes('evermiss') ||
		ua.includes('instagram') ||
		ua.includes('fbav') ||
		ua.includes('kakaotalk') ||
		ua.includes('line');

	return {
		type: isAndroid ? 'android' : isIOS ? 'ios' : 'desktop',
		isInApp,
		userAgent,
		browser
	};
}

// 앱 설정 가져오기
function getAppConfig(env: Env): AppConfig {
	const isProd = env.ENVIRONMENT === 'production';
	const domain = env.DOMAIN || 'evermiss.co.kr';

	return {
		android: {
			package: 'com.pardess.evermiss',
			scheme: 'evermiss',
			playStoreUrl: 'https://play.google.com/store/apps/details?id=com.pardess.evermiss',
			appLink: 'android-app://com.pardess.evermiss',
			intentUrl: 'intent://'
		},
		ios: {
			bundleId: 'com.pardess.evermiss',
			scheme: 'evermiss',
			appStoreUrl: 'https://apps.apple.com/app/evermiss/id1234567890', // 실제 ID로 변경 필요
			universalLink: `https://${domain}`,
			customScheme: 'evermiss://'
		},
		web: {
			fallbackUrl: isProd ? `https://${domain}` : `https://dev.${domain}`
		}
	};
}

function buildStrictIntentUrl(deepPath: string, pkg: string, playUrl: string): string {
	const p = deepPath.startsWith('/') ? deepPath.slice(1) : deepPath;
	return `intent://${p}` +
		`#Intent;scheme=evermiss;package=${pkg};` +
		`action=android.intent.action.VIEW;` +
		`category=android.intent.category.BROWSABLE;` +
		`S.browser_fallback_url=${encodeURIComponent(playUrl)};` +
		`end`;
}

function buildGenericIntentUrl(deepPath: string): string {
	const p = deepPath.startsWith('/') ? deepPath.slice(1) : deepPath;
	return `intent://${p}` +
		`#Intent;scheme=evermiss;` +
		`action=android.intent.action.VIEW;` +
		`category=android.intent.category.BROWSABLE;` +
		`end`;
}

// 개인 추모관 딥링크 처리
function handlePrivateMemorialDeeplink(
	request: Request,
	device: DeviceInfo,
	config: AppConfig
): Response {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');
	const memorialId = pathParts[2];

	console.log(`Private memorial deeplink: ${memorialId}, Device: ${device.type}, Browser: ${device.browser}`);

	// 개인 추모관
	if (device.type === 'android') {
		const deepPath = `memorial/${memorialId}`;
		const strictUrl = buildStrictIntentUrl(deepPath, config.android.package, config.android.playStoreUrl);
		const genericUrl = buildGenericIntentUrl(deepPath);

		// 삼성 브라우저는 302로 바로 intent 이동(가장 잘 동작)
		if (device.browser === 'samsung') {
			return Response.redirect(strictUrl, 302);
		}

		return new Response(
			generateAndroidHTML('memorial', memorialId, strictUrl, config.android.playStoreUrl, genericUrl),
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}

	if (device.type === 'ios') {
		const customScheme = `evermiss://memorial/${memorialId}`;

		return new Response(generateIOSHTML('memorial', memorialId, customScheme, config.ios.appStoreUrl), {
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		});
	}

	// 데스크톱
	return new Response(generateDesktopPage('memorial', memorialId), {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

// 공인 추모관 딥링크 처리
function handlePublicMemorialDeeplink(
	request: Request,
	device: DeviceInfo,
	config: AppConfig
): Response {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');
	const celebrityId = pathParts[2];

	console.log(`Celebrity memorial deeplink: ${celebrityId}, Device: ${device.type}`);

	if (device.type === 'android') {
		const deepPath = `celebrity/${celebrityId}`;
		const strictUrl = buildStrictIntentUrl(deepPath, config.android.package, config.android.playStoreUrl);
		const genericUrl = buildGenericIntentUrl(deepPath);
		if (device.browser === 'samsung') return Response.redirect(strictUrl, 302);
		return new Response(
			generateAndroidHTML('celebrity', celebrityId, strictUrl, config.android.playStoreUrl, genericUrl),
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}
	if (device.type === 'ios') {
		const customScheme = `evermiss://celebrity/${celebrityId}`;

		return new Response(generateIOSHTML('celebrity', celebrityId, customScheme, config.ios.appStoreUrl), {
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		});
	}

	// 데스크톱
	return new Response(generateDesktopPage('celebrity', celebrityId), {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

// 초대 링크 처리
function handleInviteDeeplink(
	request: Request,
	device: DeviceInfo,
	config: AppConfig
): Response {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const memorialId = url.searchParams.get('memorial_id');

	if (!code || !memorialId) {
		return new Response('Missing parameters', { status: 400 });
	}

	const params = `?code=${code}&memorial_id=${memorialId}`;

	if (device.type === 'android') {
		const deepPath = `invite?code=${encodeURIComponent(code)}&memorial_id=${encodeURIComponent(memorialId)}`;
		const strictUrl = buildStrictIntentUrl(deepPath, config.android.package, config.android.playStoreUrl);
		const genericUrl = buildGenericIntentUrl(deepPath);
		if (device.browser === 'samsung') return Response.redirect(strictUrl, 302);
		return new Response(
			generateAndroidHTML('invite', memorialId, strictUrl, config.android.playStoreUrl, genericUrl),
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}

	if (device.type === 'ios') {
		return Response.redirect(`evermiss://invite${params}`, 302);
	}

	return Response.redirect(`${config.web.fallbackUrl}/invite${params}`, 302);
}

// 공유 링크 처리
function handleShareDeeplink(
	request: Request,
	device: DeviceInfo,
	config: AppConfig
): Response {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');
	const shareType = pathParts[2];
	const shareId = pathParts[3];

	if (!shareType || !shareId) {
		return new Response('Invalid share link', { status: 400 });
	}

	const deepPath = `/share/${shareType}/${shareId}`;

	if (device.type === 'android') {
		const deepPath = `share/${shareType}/${shareId}`;
		const strictUrl = buildStrictIntentUrl(deepPath, config.android.package, config.android.playStoreUrl);
		const genericUrl = buildGenericIntentUrl(deepPath);
		if (device.browser === 'samsung') return Response.redirect(strictUrl, 302);
		return new Response(
			generateAndroidHTML('share', `${shareType}/${shareId}`, strictUrl, config.android.playStoreUrl, genericUrl),
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}

	if (device.type === 'ios') {
		return Response.redirect(`evermiss:${deepPath}`, 302);
	}

	return Response.redirect(`${config.web.fallbackUrl}${deepPath}`, 302);
}

// Android HTML 템플릿
function generateAndroidHTML(
	type: string,
	contentId: string,
	strictIntentUrl: string,
	playStoreUrl: string,
	genericIntentUrl?: string
): string {
	const altBtn = genericIntentUrl
		? `<a href="${genericIntentUrl}" class="button" id="openAppAlt">앱에서 열기(대체)</a>`
		: '';

	return `<!DOCTYPE html>
<html lang="ko"><head>…(스타일 생략)…</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Evermiss 앱으로 이동 중...</h1>
    <p>열리지 않으면 아래 버튼을 눌러주세요.</p>
    <div style="margin-top: 30px;">
      <a href="${strictIntentUrl}" class="button" id="openApp">앱에서 열기</a>
      ${altBtn}
      <a href="${playStoreUrl}" class="button" id="downloadApp">앱 설치하기</a>
    </div>
  </div>
  <script>
    (function(){
      var strictUrl = ${JSON.stringify(strictIntentUrl)};
      var altUrl    = ${JSON.stringify(genericIntentUrl || '')};
      var playUrl   = ${JSON.stringify(playStoreUrl)};
      var opened = false;

      document.addEventListener('visibilitychange', function(){ if(document.hidden) opened = true; });
      window.addEventListener('blur', function(){ opened = true; });

      // 1) 엄격 인텐트 자동 시도
      try { window.location.replace(strictUrl); } catch(e) {}

      // 2) 1200ms 내 포커스 유지되면 범용 인텐트로 재시도
      setTimeout(function(){
        if (!opened && !document.hidden && altUrl) {
          try { window.location.replace(altUrl); } catch(e) {}
        }
      }, 1200);

      // 3) 2500ms 후에도 그대로면 스토어 폴백
      setTimeout(function(){
        if (!opened && !document.hidden) { window.location.href = playUrl; }
      }, 2500);

      document.getElementById('openApp').addEventListener('click', function(e){
        e.preventDefault(); window.location.href = strictUrl;
      });
      var alt = document.getElementById('openAppAlt');
      if (alt && altUrl) {
        alt.addEventListener('click', function(e){
          e.preventDefault(); window.location.href = altUrl;
        });
      }
      document.getElementById('downloadApp').addEventListener('click', function(e){
        e.preventDefault(); window.location.href = playUrl;
      });
    })();
  </script>
</body></html>`;
}
// iOS HTML 템플릿
function generateIOSHTML(type: string, contentId: string, customScheme: string, appStoreUrl: string): string {
	const titleMap: Record<string, string> = {
		memorial: '추모관',
		celebrity: '공인 추모관'
	};

	return `
<!DOCTYPE html>
<html lang="ko">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Evermiss - 영원한 추억을 간직하세요</title>
 <meta property="og:title" content="Evermiss ${titleMap[type] || '콘텐츠'}">
 <meta property="og:description" content="소중한 추억이 기다리고 있습니다">
 <meta property="og:image" content="https://evermiss.co.kr/og-image.png">
 <style>
   body {
     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
     display: flex;
     justify-content: center;
     align-items: center;
     height: 100vh;
     margin: 0;
   }
   .container {
     text-align: center;
     padding: 40px;
     background: rgba(255, 255, 255, 0.1);
     border-radius: 20px;
     backdrop-filter: blur(10px);
     -webkit-backdrop-filter: blur(10px);
     box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
   }
   h1 {
     font-size: 24px;
     margin-bottom: 10px;
   }
   p {
     font-size: 16px;
     opacity: 0.9;
     margin-bottom: 30px;
   }
   .button {
     display: inline-block;
     margin: 10px;
     padding: 16px 32px;
     background: white;
     color: #667eea;
     text-decoration: none;
     border-radius: 30px;
     font-weight: 600;
     transition: transform 0.2s;
     box-shadow: 0 4px 15px 0 rgba(31, 38, 135, 0.2);
   }
   .button:active {
     transform: scale(0.95);
   }
   .spinner {
     border: 3px solid rgba(255, 255, 255, 0.3);
     border-radius: 50%;
     border-top: 3px solid white;
     width: 40px;
     height: 40px;
     animation: spin 1s linear infinite;
     margin: 20px auto;
   }
   @keyframes spin {
     0% { transform: rotate(0deg); }
     100% { transform: rotate(360deg); }
   }
 </style>
</head>
<body>
 <div class="container">
   <div class="spinner"></div>
   <h1>Evermiss 앱으로 이동 중...</h1>
   <p>잠시만 기다려주세요</p>

   <div style="margin-top: 30px;">
     <a href="${customScheme}" class="button">앱에서 열기</a>
     <a href="${appStoreUrl}" class="button">앱 설치하기</a>
   </div>
 </div>

 <script>
   let appOpened = false;

   // 페이지 숨김 감지
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       appOpened = true;
     }
   });

   // Custom Scheme 시도
   window.location.href = '${customScheme}';

   // 2.5초 후 앱이 열리지 않으면 App Store로
   setTimeout(() => {
     if (!appOpened && !document.hidden) {
       window.location.href = '${appStoreUrl}';
     }
   }, 2500);
 </script>
</body>
</html>`;
}

// 홈페이지 HTML
function generateHomePage(env: Env): string {
	const domain = env.DOMAIN || 'evermiss.co.kr';
	const environment = env.ENVIRONMENT || 'development';

	return `
<!DOCTYPE html>
<html lang="ko">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Evermiss - 딥링크 서비스</title>
 <style>
   body {
     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
     min-height: 100vh;
     margin: 0;
     padding: 20px;
   }
   .container {
     max-width: 800px;
     margin: 0 auto;
     padding: 40px;
     background: rgba(255, 255, 255, 0.1);
     border-radius: 20px;
     backdrop-filter: blur(10px);
     box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
   }
   h1 {
     font-size: 36px;
     margin-bottom: 20px;
     text-align: center;
   }
   .section {
     margin: 30px 0;
     padding: 20px;
     background: rgba(255, 255, 255, 0.1);
     border-radius: 10px;
   }
   .section h2 {
     font-size: 24px;
     margin-bottom: 15px;
   }
   .endpoint {
     background: rgba(0, 0, 0, 0.2);
     padding: 10px 15px;
     border-radius: 5px;
     margin: 10px 0;
     font-family: monospace;
   }
   .example {
     color: #ffd700;
   }
   a {
     color: #ffd700;
     text-decoration: none;
   }
   a:hover {
     text-decoration: underline;
   }
   .status {
     text-align: center;
     padding: 20px;
     background: rgba(0, 255, 0, 0.2);
     border-radius: 10px;
     margin-bottom: 30px;
   }
   .button {
     display: inline-block;
     padding: 12px 24px;
     background: white;
     color: #667eea;
     border-radius: 25px;
     font-weight: 600;
     margin: 5px;
     transition: transform 0.2s;
   }
   .button:hover {
     transform: translateY(-2px);
     text-decoration: none;
   }
 </style>
</head>
<body>
 <div class="container">
   <h1>🔗 Evermiss 딥링크 서비스</h1>

   <div class="status">
     <h3>✅ 서비스 정상 작동 중</h3>
     <p>Environment: ${environment}</p>
     <p>Domain: ${domain}</p>
   </div>

   <div class="section">
     <h2>📱 딥링크 엔드포인트</h2>

     <div class="endpoint">
       <strong>개인 추모관:</strong><br>
       <span class="example">https://${domain}/memorial/{memorialId}</span><br>
       <span class="example">https://${domain}/m/{memorialId}</span> (단축)
     </div>

     <div class="endpoint">
       <strong>공인 추모관:</strong><br>
       <span class="example">https://${domain}/celebrity/{celebrityId}</span><br>
       <span class="example">https://${domain}/c/{celebrityId}</span> (단축)
     </div>

     <div class="endpoint">
       <strong>초대 링크:</strong><br>
       <span class="example">https://${domain}/invite?code={code}&memorial_id={id}</span>
     </div>

     <div class="endpoint">
       <strong>공유 링크:</strong><br>
       <span class="example">https://${domain}/share/{type}/{id}</span>
     </div>
   </div>

   <div class="section">
     <h2>📊 테스트 링크</h2>
     <p>
       <a href="/memorial/test123" class="button">개인 추모관</a>
       <a href="/celebrity/test456" class="button">공인 추모관</a>
       <a href="/invite?code=ABC123&memorial_id=456" class="button">초대 테스트</a>
       <a href="/share/photo/789" class="button">공유 테스트</a>
     </p>
   </div>

   <div class="section">
     <h2>📖 사용 예시</h2>
     <p>Android 앱에서:</p>
     <div class="endpoint">
       val privateMemorial = "https://${domain}/memorial/\${memorialId}"<br>
       val publicMemorial = "https://${domain}/celebrity/\${celebrityId}"<br>
       startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(deeplink)))
     </div>

     <p>iOS 앱에서:</p>
     <div class="endpoint">
       let privateMemorial = "https://${domain}/memorial/\\(memorialId)"<br>
       let publicMemorial = "https://${domain}/celebrity/\\(celebrityId)"<br>
       UIApplication.shared.open(URL(string: deeplink)!)
     </div>
   </div>

   <div style="text-align: center; margin-top: 40px; opacity: 0.8;">
     <p>Evermiss Deeplink Service v2.0</p>
     <p>Powered by Cloudflare Workers</p>
   </div>
 </div>
</body>
</html>`;
}

// 데스크톱 안내 페이지
function generateDesktopPage(type: string, contentId: string): string {
	const titleMap: Record<string, string> = {
		memorial: '추모관',
		celebrity: '공인 추모관'
	};

	return `
<!DOCTYPE html>
<html lang="ko">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Evermiss - 모바일 앱에서 확인하세요</title>
 <style>
   body {
     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
     display: flex;
     justify-content: center;
     align-items: center;
     height: 100vh;
     margin: 0;
   }
   .container {
     text-align: center;
     padding: 40px;
     background: rgba(255, 255, 255, 0.1);
     border-radius: 20px;
     backdrop-filter: blur(10px);
     box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
     max-width: 400px;
   }
   .qr-code {
     background: white;
     padding: 20px;
     border-radius: 10px;
     margin: 20px 0;
   }
   h1 {
     font-size: 28px;
     margin-bottom: 20px;
   }
   p {
     font-size: 18px;
     margin-bottom: 30px;
     opacity: 0.9;
   }
   .store-links {
     margin-top: 30px;
   }
   .store-links img {
     height: 50px;
     margin: 10px;
   }
 </style>
</head>
<body>
 <div class="container">
   <h1>📱 모바일 앱에서 확인하세요</h1>
   <p>이 ${titleMap[type] || '콘텐츠'}는 Evermiss 모바일 앱에서 확인할 수 있습니다.</p>
   <div class="store-links">
     <a href="https://play.google.com/store/apps/details?id=com.pardess.evermiss">
       <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play">
     </a>
     <a href="https://apps.apple.com/app/evermiss/id1234567890">
       <img src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" alt="Download on the App Store">
     </a>
   </div>
 </div>
</body>
</html>`;
}
