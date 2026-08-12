// 화면 전환에 사용하는 하단 메뉴 버튼과 각 화면을 모두 찾아 둡니다.
const navigationItems = document.querySelectorAll("[data-view]");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const internalMoveButtons = document.querySelectorAll("[data-go-to]");

// 짧은 안내 문구를 보여 주는 토스트 관련 요소입니다.
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toastMessage");
const notificationButton = document.querySelector("#notificationButton");
let toastTimer;

// Render 런타임이 config.js로 전달한 공개 설정만 브라우저에서 사용합니다.
// Supabase publishable key는 공개 클라이언트용이며 service_role/secret key는 받지 않습니다.
const publicConfig = window.GREENON_PUBLIC_CONFIG ?? {};

// PHASE 9는 API 키가 필요 없는 Open-Meteo 현재 날씨 API를 서울 좌표로 호출합니다.
// 네트워크가 끊겨도 화면과 미션 안내를 체험할 수 있도록 같은 형태의 샘플 데이터를 준비합니다.
const WEATHER_API_ENDPOINT = publicConfig.weatherApiUrl || "https://api.open-meteo.com/v1/forecast";
const WEATHER_LOCATION = Object.freeze({
  name: publicConfig.weatherLocationName || "서울",
  latitude: Number(publicConfig.weatherLatitude ?? 37.5665),
  longitude: Number(publicConfig.weatherLongitude ?? 126.978),
  timezone: publicConfig.weatherTimezone || "Asia/Seoul",
});
const SAMPLE_WEATHER = Object.freeze({
  temperature: 31,
  humidity: 68,
  apparentTemperature: 34,
  weatherCode: 1,
  isDay: true,
  observedAt: null,
});

const weatherState = {
  ...SAMPLE_WEATHER,
  missionType: "hot",
  source: "sample",
};

const weatherCard = document.querySelector("#weatherCard");
const weatherSourceBadge = document.querySelector("#weatherSourceBadge");
const weatherLocation = document.querySelector("#weatherLocation");
const weatherUpdatedAt = document.querySelector("#weatherUpdatedAt");
const weatherRefreshButton = document.querySelector("#weatherRefreshButton");
const weatherSymbol = document.querySelector("#weatherSymbol");
const weatherTemperature = document.querySelector("#weatherTemperature");
const weatherOutdoorTemperature = document.querySelector("#weatherOutdoorTemperature");
const weatherHumidity = document.querySelector("#weatherHumidity");
const weatherFeelsLike = document.querySelector("#weatherFeelsLike");
const weatherDescription = document.querySelector("#weatherDescription");
const weatherMissionLabel = document.querySelector("#weatherMissionLabel");
const weatherMissionCopy = document.querySelector("#weatherMissionCopy");
const weatherStatusMessage = document.querySelector("#weatherStatusMessage");

// 실제 에어컨 API 대신 화면에서 사용할 다섯 가지 가상 IoT 상태를 정의합니다.
// 각 상태는 같은 화면 구조에 값과 색상만 바꾸므로 상태별 차이를 쉽게 비교할 수 있습니다.
const airconScenarios = {
  normal: {
    statusLabel: "정상 운전",
    statusTitle: "쾌적하게 운전 중이에요",
    statusMessage: "모든 센서와 필터 상태가 정상이에요.",
    power: "ON",
    mode: "냉방",
    temperature: "26°C",
    fan: "자동",
    usage: "2시간 30분",
    filter: 82,
    updatedAt: "방금 전 갱신",
    tone: "normal",
  },
  eco: {
    statusLabel: "절전 운전",
    statusTitle: "에너지를 아끼며 운전 중이에요",
    statusMessage: "27°C 설정으로 선선한 날의 과냉방을 줄이고 있어요.",
    power: "ON",
    mode: "냉방",
    temperature: "27°C",
    fan: "자동",
    usage: "1시간",
    filter: 82,
    updatedAt: "방금 전 갱신",
    tone: "normal",
  },
  filter: {
    statusLabel: "필터 점검 필요",
    statusTitle: "필터 청소가 필요해요",
    statusMessage: "필터 잔여 수명이 낮아요. 깨끗하게 청소해 주세요.",
    power: "ON",
    mode: "냉방",
    temperature: "24°C",
    fan: "강풍",
    usage: "128시간",
    filter: 12,
    updatedAt: "점검 알림 발생",
    tone: "danger",
  },
  sensor: {
    statusLabel: "센서 오류",
    statusTitle: "온도 센서를 확인해 주세요",
    statusMessage: "센서 값을 읽을 수 없어 안전한 상태 확인이 필요해요.",
    power: "ON",
    mode: "확인 필요",
    temperature: "--",
    fan: "정지",
    usage: "1시간 10분",
    filter: 78,
    updatedAt: "센서 연결 끊김",
    tone: "danger",
  },
  off: {
    statusLabel: "전원 꺼짐",
    statusTitle: "에어컨이 쉬고 있어요",
    statusMessage: "현재 운전하지 않는 정상 대기 상태예요.",
    power: "OFF",
    mode: "대기",
    temperature: "--",
    fan: "정지",
    usage: "오늘 0분",
    filter: 82,
    updatedAt: "1분 전 갱신",
    tone: "off",
  },
};

const airconStatusCard = document.querySelector("#airconStatusCard");
const airconScenarioButtons = document.querySelectorAll("[data-aircon-scenario]");
const filterProgress = document.querySelector("#filterProgress");
const filterProgressBar = document.querySelector("#filterProgressBar");
let currentAirconScenarioName = "normal";

// 화면에 표시할 현재 미션 상태이며, PHASE 8부터 Supabase 행을 이 객체에 반영합니다.
const missionState = {
  status: "available",
  elapsedMinutes: 0,
  consecutiveViolations: 0,
  rewardAwarded: false,
};

const missionCard = document.querySelector("#missionCard");
const missionStateChip = document.querySelector("#missionStateChip");
const missionElapsed = document.querySelector("#missionElapsed");
const missionProgress = document.querySelector("#missionProgress");
const missionProgressBar = document.querySelector("#missionProgressBar");
const missionStatusSymbol = document.querySelector("#missionStatusSymbol");
const missionStatusTitle = document.querySelector("#missionStatusTitle");
const missionStatusMessage = document.querySelector("#missionStatusMessage");
const missionStartButton = document.querySelector("#missionStartButton");
const missionAdvanceButton = document.querySelector("#missionAdvanceButton");
const missionRetryButton = document.querySelector("#missionRetryButton");
const missionWalletButton = document.querySelector("#missionWalletButton");
const missionRewardLabel = document.querySelector("#missionRewardLabel");
const missionRewardPoints = document.querySelector("#missionRewardPoints");
const missionCardTitle = document.querySelector("#missionCardTitle");
const missionDescription = document.querySelector("#missionDescription");
const missionTargetMinutes = document.querySelector("#missionTargetMinutes");
const missionDate = document.querySelector("#missionDate");
const missionConditionItems = document.querySelectorAll("[data-mission-condition]");

// PHASE 8부터 GREEN POINT와 기록은 로그인한 사용자의 Supabase 데이터만 사용합니다.
const pointFilterButtons = document.querySelectorAll("[data-point-filter]");
const walletBalance = document.querySelector("#walletBalance");
const walletTotalEarned = document.querySelector("#walletTotalEarned");
const walletTotalUsed = document.querySelector("#walletTotalUsed");
const walletMissionRewardStatus = document.querySelector("#walletMissionRewardStatus");
const walletMissionRewardPoints = document.querySelector("#walletMissionRewardPoints");
const pointHistoryCount = document.querySelector("#pointHistoryCount");
const pointTransactionList = document.querySelector("#pointTransactionList");
const pointEmptyState = document.querySelector("#pointEmptyState");
let activePointFilter = "all";

// 로그인 후 rewards 테이블에서 읽은 상품만 담습니다.
let rewardProducts = [];

const rewardCategoryButtons = document.querySelectorAll("[data-reward-category]");
const rewardWalletBalance = document.querySelector("#rewardWalletBalance");
const rewardProductCount = document.querySelector("#rewardProductCount");
const rewardProductGrid = document.querySelector("#rewardProductGrid");
const rewardOrderCount = document.querySelector("#rewardOrderCount");
const rewardOrderList = document.querySelector("#rewardOrderList");
const rewardOrderEmpty = document.querySelector("#rewardOrderEmpty");
const rewardDetailDialog = document.querySelector("#rewardDetailDialog");
const rewardDialogCloseButton = document.querySelector("#rewardDialogCloseButton");
const rewardDetailVisual = document.querySelector("#rewardDetailVisual");
const rewardDetailEmoji = document.querySelector("#rewardDetailEmoji");
const rewardDetailCategory = document.querySelector("#rewardDetailCategory");
const rewardDetailTitle = document.querySelector("#rewardDetailTitle");
const rewardDetailDescription = document.querySelector("#rewardDetailDescription");
const rewardDetailPrice = document.querySelector("#rewardDetailPrice");
const rewardDetailBalance = document.querySelector("#rewardDetailBalance");
const rewardPurchaseFeedback = document.querySelector("#rewardPurchaseFeedback");
const rewardPurchaseFeedbackIcon = document.querySelector("#rewardPurchaseFeedbackIcon");
const rewardPurchaseFeedbackTitle = document.querySelector("#rewardPurchaseFeedbackTitle");
const rewardPurchaseFeedbackMessage = document.querySelector("#rewardPurchaseFeedbackMessage");
const rewardPurchaseButton = document.querySelector("#rewardPurchaseButton");
let activeRewardCategory = "all";
let selectedRewardProductId = null;

// PHASE 7에서는 브라우저 공개용 publishable key로 Supabase 클라이언트를 만듭니다.
// RLS를 우회하는 service_role 또는 secret key는 프런트엔드에서 절대로 사용하지 않습니다.
const supabaseConfig = publicConfig;
const greenOnSupabase =
  window.supabase?.createClient && supabaseConfig.supabaseUrl && supabaseConfig.supabasePublishableKey
    ? window.supabase.createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "carrier-greenon-supabase-auth",
        },
      })
    : null;

// Supabase Auth 상태와 MY 화면 표시를 한곳에서 관리하는 요소입니다.
const authOpenButtons = document.querySelectorAll("[data-auth-open]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authDialog = document.querySelector("#authDialog");
const authDialogCloseButton = document.querySelector("#authDialogCloseButton");
const authDialogTitle = document.querySelector("#authDialogTitle");
const authDialogDescription = document.querySelector("#authDialogDescription");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const signupForm = document.querySelector("#signupForm");
const signupName = document.querySelector("#signupName");
const signupEmail = document.querySelector("#signupEmail");
const signupPassword = document.querySelector("#signupPassword");
const signupPasswordConfirm = document.querySelector("#signupPasswordConfirm");
const signupError = document.querySelector("#signupError");
const logoutButton = document.querySelector("#logoutButton");
const myGuestView = document.querySelector("#myGuestView");
const myMemberView = document.querySelector("#myMemberView");
const myUserInitial = document.querySelector("#myUserInitial");
const myUserName = document.querySelector("#myUserName");
const myUserEmail = document.querySelector("#myUserEmail");
const authStorageNotice = document.querySelector("#authStorageNotice");
const greenLevelNumber = document.querySelector("#greenLevelNumber");
const greenLevelIcon = document.querySelector("#greenLevelIcon");
const greenLevelName = document.querySelector("#greenLevelName");
const greenLevelKoreanName = document.querySelector("#greenLevelKoreanName");
const greenLevelDescription = document.querySelector("#greenLevelDescription");
const greenLevelProgressLabel = document.querySelector("#greenLevelProgressLabel");
const greenLevelCurrentPoints = document.querySelector("#greenLevelCurrentPoints");
const greenLevelNextPoints = document.querySelector("#greenLevelNextPoints");
const greenLevelProgress = document.querySelector("#greenLevelProgress");
const greenLevelProgressBar = document.querySelector("#greenLevelProgressBar");
const greenReportMonth = document.querySelector("#greenReportMonth");
const reportMissionCount = document.querySelector("#reportMissionCount");
const reportEarnedPoints = document.querySelector("#reportEarnedPoints");
const reportUsedPoints = document.querySelector("#reportUsedPoints");
const reportRewardCount = document.querySelector("#reportRewardCount");
const reportEnergySaved = document.querySelector("#reportEnergySaved");
const reportCarbonSaved = document.querySelector("#reportCarbonSaved");
const greenReportTodayBar = document.querySelector("#greenReportTodayBar");

// 누적 적립 포인트에 따라 레벨이 올라가는 교육용 GREEN LEVEL 기준입니다.
const greenLevels = [
  {
    number: 1,
    minimum: 0,
    next: 500,
    name: "GREEN SEED",
    koreanName: "초록 씨앗",
    icon: "🌱",
    description: "첫 친환경 냉방 습관을 시작했어요.",
  },
  {
    number: 2,
    minimum: 500,
    next: 1500,
    name: "GREEN SPROUT",
    koreanName: "초록 새싹",
    icon: "🌿",
    description: "꾸준한 실천으로 초록 습관이 자라고 있어요.",
  },
  {
    number: 3,
    minimum: 1500,
    next: 3000,
    name: "GREEN LEAF",
    koreanName: "초록 잎새",
    icon: "🍃",
    description: "생활 속 친환경 냉방을 능숙하게 실천하고 있어요.",
  },
  {
    number: 4,
    minimum: 3000,
    next: null,
    name: "GREEN TREE",
    koreanName: "초록 나무",
    icon: "🌳",
    description: "지속 가능한 냉방 습관을 이끄는 GreenON 마스터예요.",
  },
];

/** 로그아웃 상태 또는 데이터 조회 전 사용할 비어 있는 화면 상태입니다. */
function createEmptyWalletState() {
  return {
    balance: 0,
    awardedMissionIds: [],
    orders: [],
    transactions: [],
  };
}

let walletState = createEmptyWalletState();
let missionDefinitions = [];
let missionDefinition = null;
let currentUserMissionId = null;

// Supabase 세션을 MY 화면에 필요한 최소 정보로 정리해 메모리에만 보관합니다.
let authState = {
  account: null,
  session: null,
};

/** Supabase Auth 오류를 사용자에게 이해하기 쉬운 한국어 문장으로 바꿉니다. */
function getAuthErrorMessage(error, mode) {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) return "이메일 또는 비밀번호가 일치하지 않아요.";
  if (message.includes("email not confirmed")) return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "이미 가입된 이메일이에요. 로그인 탭을 이용해 주세요.";
  }
  if (message.includes("rate limit")) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  if (message.includes("network") || message.includes("fetch")) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

  return mode === "signup"
    ? "회원가입을 완료하지 못했어요. 입력 내용을 확인해 주세요."
    : "로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/** 브라우저의 현지 날짜를 Supabase date 컬럼과 같은 YYYY-MM-DD로 만듭니다. */
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 날씨 숫자를 불필요한 소수점 없이 최대 한 자리까지 표시합니다. */
function formatWeatherNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}

/** WMO 날씨 코드를 사용자가 이해하기 쉬운 아이콘과 문장으로 바꿉니다. */
function getWeatherPresentation(weatherCode, isDay) {
  if (weatherCode === 0) return { symbol: isDay ? "☀️" : "🌙", description: "맑은 날씨" };
  if ([1, 2].includes(weatherCode)) return { symbol: isDay ? "🌤️" : "☁️", description: "구름이 조금 있어요" };
  if (weatherCode === 3) return { symbol: "☁️", description: "흐린 날씨" };
  if ([45, 48].includes(weatherCode)) return { symbol: "🌫️", description: "안개가 낀 날씨" };
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return { symbol: "🌨️", description: "눈이 오는 날씨" };
  if ([95, 96, 99].includes(weatherCode)) return { symbol: "⛈️", description: "천둥번개가 있는 날씨" };
  if (weatherCode >= 51 && weatherCode <= 82) return { symbol: "🌧️", description: "비가 오는 날씨" };
  return { symbol: "🌤️", description: "변화가 있는 날씨" };
}

/** 외부온도·체감온도·습도·강수 코드를 오늘의 미션 분류로 바꿉니다. */
function classifyWeatherMission(weather) {
  if (weather.temperature >= 30 || weather.apparentTemperature >= 32) return "hot";

  const hasWetWeather = weather.weatherCode >= 51 && weather.weatherCode <= 99;
  if (weather.humidity >= 70 || hasWetWeather) return "humid";
  return "mild";
}

/** 날씨 분류별 미션 안내 문구를 한곳에서 관리합니다. */
function getWeatherMissionGuide(missionType) {
  const guides = {
    hot: {
      label: "무더운 날 미션",
      copy: "26°C 친환경 냉방으로 시원함과 에너지 절약을 함께 챙겨요.",
    },
    humid: {
      label: "습한 날 미션",
      copy: "26°C 쾌적 냉방으로 높은 습도에 대응하고 과냉방은 줄여요.",
    },
    mild: {
      label: "선선한 날 미션",
      copy: "27°C 절전 냉방으로 필요한 만큼만 시원하게 에너지를 아껴요.",
    },
  };

  return guides[missionType] ?? guides.hot;
}

/** 아직 참여 전이면 최신 날씨 분류와 맞는 Supabase 미션으로 교체합니다. */
function selectMissionForCurrentWeather() {
  if (currentUserMissionId || missionDefinitions.length === 0) return;

  const weatherMission = missionDefinitions.find(
    (mission) => mission.weather_condition === weatherState.missionType,
  );
  if (!weatherMission || weatherMission.id === missionDefinition?.id) return;

  missionDefinition = weatherMission;
  renderMissionDefinition();
  renderMissionState();
}

/** 실시간 또는 샘플 날씨를 홈 카드와 오늘의 미션 추천에 함께 반영합니다. */
function renderWeather(weather, { source, isError = false, statusMessage }) {
  const missionType = classifyWeatherMission(weather);
  const presentation = getWeatherPresentation(weather.weatherCode, weather.isDay);
  const missionGuide = getWeatherMissionGuide(missionType);

  Object.assign(weatherState, weather, { missionType, source });

  weatherCard.dataset.weatherState = source;
  weatherCard.classList.toggle("is-danger", isError);
  weatherSourceBadge.dataset.source = isError ? "error" : source;
  weatherSourceBadge.textContent = source === "live" ? "실시간 API" : "샘플 데이터";
  weatherLocation.textContent = WEATHER_LOCATION.name;
  weatherUpdatedAt.textContent = weather.observedAt
    ? `${weather.observedAt.slice(11, 16)} 기준`
    : "샘플 기준";
  weatherSymbol.textContent = presentation.symbol;
  weatherTemperature.textContent = formatWeatherNumber(weather.temperature);
  weatherOutdoorTemperature.textContent = formatWeatherNumber(weather.temperature);
  weatherHumidity.textContent = formatWeatherNumber(weather.humidity);
  weatherFeelsLike.textContent = formatWeatherNumber(weather.apparentTemperature);
  weatherDescription.textContent = presentation.description;
  weatherMissionLabel.textContent = missionGuide.label;
  weatherMissionCopy.textContent = missionGuide.copy;
  weatherStatusMessage.textContent = statusMessage;

  selectMissionForCurrentWeather();
}

/** 공식 Open-Meteo 현재 날씨 API URL을 명시적인 쿼리 파라미터로 만듭니다. */
function createWeatherApiUrl() {
  const parameters = new URLSearchParams({
    latitude: String(WEATHER_LOCATION.latitude),
    longitude: String(WEATHER_LOCATION.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day",
    timezone: WEATHER_LOCATION.timezone,
  });
  return `${WEATHER_API_ENDPOINT}?${parameters.toString()}`;
}

/** 현재 날씨를 불러오고 실패하면 Red 안내와 함께 샘플 데이터로 안전하게 전환합니다. */
async function loadCurrentWeather() {
  const requestController = new AbortController();
  const timeoutId = window.setTimeout(() => requestController.abort(), 8000);

  weatherRefreshButton.disabled = true;
  weatherRefreshButton.classList.add("is-loading");
  weatherSourceBadge.removeAttribute("data-source");
  weatherSourceBadge.textContent = "업데이트 중";

  try {
    const response = await fetch(createWeatherApiUrl(), { signal: requestController.signal });
    if (!response.ok) throw new Error(`weather_http_${response.status}`);

    const payload = await response.json();
    const current = payload.current;
    if (
      !current ||
      !Number.isFinite(current.temperature_2m) ||
      !Number.isFinite(current.relative_humidity_2m) ||
      !Number.isFinite(current.apparent_temperature)
    ) {
      throw new Error("weather_payload_invalid");
    }

    renderWeather(
      {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        apparentTemperature: current.apparent_temperature,
        weatherCode: current.weather_code,
        isDay: current.is_day === 1,
        observedAt: current.time,
      },
      {
        source: "live",
        statusMessage: "Open-Meteo 현재 날씨를 사용해 오늘의 미션을 추천했어요.",
      },
    );
  } catch (error) {
    console.warn("실시간 날씨를 불러오지 못해 샘플 데이터를 사용합니다.", error);
    renderWeather(SAMPLE_WEATHER, {
      source: "sample",
      isError: true,
      statusMessage: "날씨 API 연결 오류로 샘플 데이터를 표시하고 있어요. 새로고침해 주세요.",
    });
  } finally {
    window.clearTimeout(timeoutId);
    weatherRefreshButton.disabled = false;
    weatherRefreshButton.classList.remove("is-loading");
  }
}

/** 로그아웃하거나 사용자가 바뀔 때 이전 사용자의 화면 데이터를 즉시 비웁니다. */
function resetSupabaseDataState() {
  walletState = createEmptyWalletState();
  rewardProducts = [];
  missionDefinitions = [];
  missionDefinition = null;
  currentUserMissionId = null;
  missionState.status = "available";
  missionState.elapsedMinutes = 0;
  missionState.consecutiveViolations = 0;
  missionState.rewardAwarded = false;

  renderMissionState();
  renderWallet();
  renderRewardShop();
}

/** Supabase 행을 기존 UI가 사용하는 화면 상태 모양으로 변환합니다. */
function applyUserMissionRow(userMission) {
  currentUserMissionId = userMission?.id ?? null;
  missionState.status = userMission?.status ?? "available";
  missionState.elapsedMinutes = userMission?.elapsed_minutes ?? 0;
  missionState.consecutiveViolations = userMission?.consecutive_violations ?? 0;
  missionState.rewardAwarded = Boolean(userMission?.points_awarded);
}

/** DB에 저장된 가상 에어컨 행에서 대응하는 화면 시나리오를 찾습니다. */
function getScenarioNameFromAirconRow(airconRow) {
  if (!airconRow) return "normal";
  if (!airconRow.power_on) return "off";
  if (airconRow.sensor_status === "error" || airconRow.mode === "error") return "sensor";
  if (airconRow.filter_life <= 20) return "filter";
  if (Number(airconRow.set_temperature) >= 27) return "eco";
  return "normal";
}

/**
 * 로그인 사용자의 포인트·미션·상품·구매·에어컨 데이터를 RLS가 적용된 쿼리로 읽습니다.
 * 다른 계정으로 전환된 사이 늦게 도착한 응답은 화면에 반영하지 않습니다.
 */
async function loadSupabaseData(userId) {
  const today = getLocalDateKey();
  const responses = await Promise.all([
    greenOnSupabase.from("green_levels").select("*").order("minimum_points", { ascending: true }),
    greenOnSupabase.from("missions").select("*").eq("is_active", true).order("id", { ascending: true }),
    greenOnSupabase
      .from("user_missions")
      .select("*")
      .order("mission_date", { ascending: false })
      .order("created_at", { ascending: false }),
    greenOnSupabase
      .from("point_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    greenOnSupabase.from("rewards").select("*").eq("is_active", true).order("id", { ascending: true }),
    greenOnSupabase
      .from("reward_orders")
      .select("id, reward_id, product_name, points_spent, status, ordered_at, rewards(category, emoji)")
      .order("ordered_at", { ascending: false })
      .limit(100),
    greenOnSupabase.from("aircon_status").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const failedResponse = responses.find((response) => response.error);
  if (failedResponse) throw failedResponse.error;
  if (authState.session?.userId !== userId) return;

  const [levelResponse, missionResponse, userMissionResponse, transactionResponse, rewardResponse, orderResponse, airconResponse] =
    responses;

  greenLevels = levelResponse.data.map((level, index, levels) => ({
    number: level.id,
    minimum: level.minimum_points,
    next: levels[index + 1]?.minimum_points ?? null,
    name: level.name,
    koreanName: level.korean_name,
    icon: level.icon,
    description: level.description,
  }));

  missionDefinitions = missionResponse.data;
  const todayMission = userMissionResponse.data.find((item) => item.mission_date === today) ?? null;
  missionDefinition = todayMission
    ? missionDefinitions.find((mission) => mission.id === todayMission.mission_id) ?? null
    : missionDefinitions.find((mission) => mission.weather_condition === weatherState.missionType) ??
      missionDefinitions.find((mission) => mission.weather_condition === "hot") ??
      missionDefinitions[0] ??
      null;
  renderMissionDefinition();
  applyUserMissionRow(todayMission);

  rewardProducts = rewardResponse.data.map((product) => ({
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    detail: product.detail,
    price: product.price_points,
    emoji: product.emoji,
    tone: product.tone,
  }));

  const transactions = transactionResponse.data.map((transaction) => ({
    id: transaction.id,
    type: transaction.transaction_type,
    amount: transaction.amount,
    title: transaction.title,
    description: transaction.description,
    createdAt: transaction.created_at,
  }));

  walletState = {
    balance: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    awardedMissionIds: userMissionResponse.data
      .filter((item) => item.status === "success" && item.points_awarded)
      .map((item) => getMissionRewardIdForDate(item.mission_date)),
    transactions,
    orders: orderResponse.data.map((order) => ({
      id: order.id,
      productId: order.reward_id,
      productName: order.product_name,
      category: order.rewards?.category ?? "REWARD",
      points: order.points_spent,
      createdAt: order.ordered_at,
    })),
  };

  renderAirconScenario(getScenarioNameFromAirconRow(airconResponse.data));
  renderMissionState();
  renderWallet();
  renderRewardShop();
}

/** Supabase 세션과 RLS로 조회한 본인 프로필을 화면 상태에 반영합니다. */
async function syncAuthStateFromSession(session) {
  if (!session?.user) {
    authState = { account: null, session: null };
    resetSupabaseDataState();
    renderMyPage();
    return;
  }

  const user = session.user;
  let displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "GreenON 사용자";
  let storedGreenLevel = 1;

  // profiles_select_own RLS 정책 때문에 로그인한 사용자는 자신의 프로필 한 행만 읽을 수 있습니다.
  const { data: profile, error: profileError } = await greenOnSupabase
    .from("profiles")
    .select("display_name, green_level")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.warn("Supabase 프로필을 불러오지 못해 Auth 메타데이터를 사용합니다.", profileError);
  } else if (profile) {
    displayName = profile.display_name;
    storedGreenLevel = profile.green_level;
  }

  authState = {
    account: {
      userId: user.id,
      name: displayName,
      email: user.email ?? "",
      greenLevel: storedGreenLevel,
    },
    session: {
      userId: user.id,
      email: user.email ?? "",
    },
  };

  resetSupabaseDataState();
  try {
    await loadSupabaseData(user.id);
    authStorageNotice.innerHTML =
      "<strong>Supabase에 안전하게 저장됩니다.</strong> 미션·포인트·구매내역은 RLS로 사용자별 분리됩니다.";
    authStorageNotice.closest(".my-data-notice")?.classList.remove("is-danger");
  } catch (dataError) {
    console.error("Supabase 사용자 데이터를 불러오지 못했습니다.", dataError);
    authStorageNotice.textContent = "사용자 데이터를 불러오지 못했습니다. 네트워크 연결 후 새로고침해 주세요.";
    authStorageNotice.closest(".my-data-notice")?.classList.add("is-danger");
    showToast("Supabase 데이터를 불러오지 못했어요.", "danger");
  }
  renderMyPage();
}

/** 페이지 시작 시 저장된 Supabase 세션을 복원하고 이후 로그인 상태 변경을 구독합니다. */
async function initializeSupabaseAuth() {
  if (!greenOnSupabase) {
    authStorageNotice.textContent = "Supabase 설정을 불러오지 못했습니다. 관리자에게 연결 상태를 문의해 주세요.";
    authStorageNotice.closest(".my-data-notice")?.classList.add("is-danger");
    renderMyPage();
    return;
  }

  // PHASE 6~7에서 사용한 교육용 localStorage 데이터는 실제 DB 데이터와 섞이지 않게 제거합니다.
  window.localStorage.removeItem("carrier-greenon-auth-v1");
  window.localStorage.removeItem("carrier-greenon-wallet-v1");

  const { data, error } = await greenOnSupabase.auth.getSession();
  if (error) {
    console.warn("Supabase 로그인 세션을 복원하지 못했습니다.", error);
    showToast("로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.", "danger");
  }
  await syncAuthStateFromSession(data?.session ?? null);

  greenOnSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;

    // Auth 콜백 내부에서 다른 Supabase 요청과 충돌하지 않도록 다음 작업 큐에서 프로필을 읽습니다.
    window.setTimeout(() => {
      syncAuthStateFromSession(session).catch((syncError) => {
        console.warn("Supabase 회원 화면 동기화에 실패했습니다.", syncError);
      });
    }, 0);
  });
}

/** 현재 Supabase 사용자와 세션이 같은 사용자 ID인지 확인합니다. */
function isAuthenticated() {
  return Boolean(authState.account && authState.session?.userId === authState.account.userId);
}

/** DB에 저장해야 하는 기능은 로그인 후에만 실행되도록 공통으로 확인합니다. */
function requireAuthenticatedUser(message = "로그인 후 이용할 수 있어요.") {
  if (isAuthenticated()) return true;

  showToast(message, "danger");
  changeView("my");
  openAuthDialog("login");
  return false;
}

/** 지갑 거래 기록에서 누적 적립액과 사용액을 계산해 여러 화면에서 함께 사용합니다. */
function getWalletStats() {
  const totalEarned = walletState.transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalUsed = Math.abs(
    walletState.transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  return { totalEarned, totalUsed };
}

/** 누적 적립액에 맞는 GREEN LEVEL 정보를 찾습니다. */
function getGreenLevel(totalEarned) {
  return [...greenLevels].reverse().find((level) => totalEarned >= level.minimum) ?? greenLevels[0];
}

/** MY 화면의 회원 프로필, GREEN LEVEL, GREEN REPORT를 현재 데이터로 갱신합니다. */
function renderMyPage() {
  const signedIn = isAuthenticated();
  myGuestView.hidden = signedIn;
  myMemberView.hidden = !signedIn;

  if (!signedIn) return;

  const { name, email } = authState.account;
  const { totalEarned, totalUsed } = getWalletStats();
  const currentLevel = getGreenLevel(totalEarned);
  const missionCount = walletState.awardedMissionIds.length;
  const rewardCount = walletState.orders.length;
  const energySaved = missionCount * 1.8;
  const carbonSaved = missionCount * 0.7;
  const activityRate = Math.min(100, 36 + missionCount * 18 + rewardCount * 8);

  myUserInitial.textContent = name.trim().charAt(0).toUpperCase() || "G";
  myUserName.textContent = name;
  myUserEmail.textContent = email;

  greenLevelNumber.textContent = currentLevel.number;
  greenLevelIcon.textContent = currentLevel.icon;
  greenLevelName.textContent = currentLevel.name;
  greenLevelKoreanName.textContent = currentLevel.koreanName;
  greenLevelDescription.textContent = currentLevel.description;
  greenLevelCurrentPoints.textContent = formatPointNumber(totalEarned);

  let progressRate = 100;
  if (currentLevel.next !== null) {
    const levelRange = currentLevel.next - currentLevel.minimum;
    progressRate = Math.min(100, ((totalEarned - currentLevel.minimum) / levelRange) * 100);
    greenLevelProgressLabel.textContent = `다음 레벨까지 ${formatPointNumber(currentLevel.next - totalEarned)} P`;
    greenLevelNextPoints.textContent = formatPointNumber(currentLevel.next);
    greenLevelProgress.setAttribute("aria-valuemax", String(currentLevel.next));
  } else {
    greenLevelProgressLabel.textContent = "최고 레벨을 달성했어요";
    greenLevelNextPoints.textContent = formatPointNumber(totalEarned);
    greenLevelProgress.setAttribute("aria-valuemax", String(totalEarned));
  }
  greenLevelProgress.setAttribute("aria-valuemin", String(currentLevel.minimum));
  greenLevelProgress.setAttribute("aria-valuenow", String(totalEarned));
  greenLevelProgressBar.style.width = `${progressRate}%`;

  greenReportMonth.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(new Date());
  reportMissionCount.textContent = missionCount;
  reportEarnedPoints.textContent = formatPointNumber(totalEarned);
  reportUsedPoints.textContent = formatPointNumber(totalUsed);
  reportRewardCount.textContent = rewardCount;
  reportEnergySaved.textContent = energySaved.toFixed(1);
  reportCarbonSaved.textContent = carbonSaved.toFixed(1);
  greenReportTodayBar.style.setProperty("--activity", `${activityRate}%`);
}

/** 인증 폼의 Red 오류 표시와 입력란 강조를 모두 지웁니다. */
function clearAuthErrors() {
  loginError.hidden = true;
  signupError.hidden = true;
  [...loginForm.elements, ...signupForm.elements].forEach((element) => {
    element.classList?.remove("is-invalid");
  });
}

/** 인증 폼 오류를 사용자에게 Red 상태로 알리고 첫 문제 입력란에 초점을 옮깁니다. */
function showAuthError(errorElement, message, inputElement) {
  errorElement.querySelector("p").textContent = message;
  errorElement.hidden = false;
  inputElement?.classList.add("is-invalid");
  inputElement?.focus();
}

/** 로그인·회원가입 탭과 제목, 폼을 선택한 모드에 맞게 전환합니다. */
function setAuthMode(mode) {
  const safeMode = mode === "signup" ? "signup" : "login";
  clearAuthErrors();
  loginForm.hidden = safeMode !== "login";
  signupForm.hidden = safeMode !== "signup";
  authDialogTitle.textContent = safeMode === "login" ? "다시 만나 반가워요" : "초록 생활을 시작해요";
  authDialogDescription.textContent =
    safeMode === "login" ? "로그인하고 나의 초록 기록을 이어가세요." : "간단한 정보로 GreenON에 함께해 주세요.";

  authModeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === safeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

/** 선택한 인증 탭으로 회원 다이얼로그를 엽니다. */
function openAuthDialog(mode = "login") {
  setAuthMode(mode);
  if (typeof authDialog.showModal === "function") {
    authDialog.showModal();
  } else {
    authDialog.setAttribute("open", "");
  }

  window.setTimeout(() => {
    (mode === "signup" ? signupName : loginEmail).focus();
  }, 0);
}

/** 인증 다이얼로그를 닫고 입력 중 표시된 오류를 초기화합니다. */
function closeAuthDialog() {
  if (typeof authDialog.close === "function") {
    authDialog.close();
  } else {
    authDialog.removeAttribute("open");
  }
  clearAuthErrors();
}

/** 인증 요청 중에는 제출 버튼을 잠가 중복 요청을 막고 완료 후 원래 문구로 복원합니다. */
function setAuthSubmitting(form, isSubmitting, pendingLabel) {
  const submitButton = form.querySelector("button[type='submit']");
  if (!submitButton.dataset.defaultLabel) {
    submitButton.dataset.defaultLabel = submitButton.textContent;
  }
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? pendingLabel : submitButton.dataset.defaultLabel;
}

/** 회원가입 폼을 검사한 뒤 Supabase Auth에 실제 사용자를 생성합니다. */
async function handleSignup(event) {
  event.preventDefault();
  clearAuthErrors();

  const name = signupName.value.trim();
  const email = signupEmail.value.trim().toLowerCase();
  const password = signupPassword.value;
  const passwordConfirm = signupPasswordConfirm.value;

  if (!name) {
    showAuthError(signupError, "이름을 입력해 주세요.", signupName);
    return;
  }
  if (!signupEmail.checkValidity()) {
    showAuthError(signupError, "올바른 이메일 주소를 입력해 주세요.", signupEmail);
    return;
  }
  if (password.length < 6) {
    showAuthError(signupError, "비밀번호는 6자 이상 입력해 주세요.", signupPassword);
    return;
  }
  if (password !== passwordConfirm) {
    showAuthError(signupError, "비밀번호 확인이 일치하지 않아요.", signupPasswordConfirm);
    return;
  }
  if (!greenOnSupabase) {
    showAuthError(signupError, "Supabase 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", signupEmail);
    return;
  }

  setAuthSubmitting(signupForm, true, "가입 중...");
  try {
    const { data, error } = await greenOnSupabase.auth.signUp({
      email,
      password,
      options: {
        // 확인 이메일을 누르면 현재 실행 중인 GreenON 주소로 돌아오게 합니다.
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        data: {
          display_name: name,
        },
      },
    });

    if (error) {
      showAuthError(signupError, getAuthErrorMessage(error, "signup"), signupEmail);
      return;
    }

    signupForm.reset();
    closeAuthDialog();

    if (data.session) {
      await syncAuthStateFromSession(data.session);
      showToast(`${name}님, GreenON 가입을 환영해요!`);
    } else {
      showToast("가입 확인 이메일을 보냈어요. 인증 후 로그인해 주세요!");
    }
  } finally {
    setAuthSubmitting(signupForm, false, "");
  }
}

/** Supabase Auth가 이메일과 비밀번호를 확인한 경우에만 로그인 세션을 시작합니다. */
async function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();

  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;
  if (!loginEmail.checkValidity() || password.length < 6) {
    showAuthError(loginError, "이메일과 6자 이상의 비밀번호를 확인해 주세요.", loginEmail);
    return;
  }

  if (!greenOnSupabase) {
    showAuthError(loginError, "Supabase 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", loginEmail);
    return;
  }

  setAuthSubmitting(loginForm, true, "로그인 중...");
  try {
    const { data, error } = await greenOnSupabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthError(loginError, getAuthErrorMessage(error, "login"), loginPassword);
      return;
    }

    await syncAuthStateFromSession(data.session);
    loginForm.reset();
    closeAuthDialog();
    showToast(`${authState.account.name}님, 다시 만나 반가워요!`);
  } finally {
    setAuthSubmitting(loginForm, false, "");
  }
}

/** Supabase의 현재 세션과 브라우저에 저장된 토큰을 함께 정리합니다. */
async function handleLogout() {
  if (!greenOnSupabase) return;

  logoutButton.disabled = true;
  const { error } = await greenOnSupabase.auth.signOut();
  logoutButton.disabled = false;

  if (error) {
    showToast("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.", "danger");
    return;
  }

  await syncAuthStateFromSession(null);
  showToast("안전하게 로그아웃했어요.");
}

/** 숫자를 한국어 천 단위 구분이 적용된 포인트 문자열로 바꿉니다. */
function formatPointNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

/** 거래 날짜를 지갑 기록에 알맞은 짧은 한국어 날짜로 표시합니다. */
function formatTransactionDate(dateValue) {
  const transactionDate = new Date(dateValue);
  const today = new Date();
  const isToday =
    transactionDate.getFullYear() === today.getFullYear() &&
    transactionDate.getMonth() === today.getMonth() &&
    transactionDate.getDate() === today.getDate();

  if (isToday) return "오늘";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(transactionDate);
}

/** DB 미션 날짜를 지갑과 리포트에서 사용할 식별자로 바꿉니다. */
function getMissionRewardIdForDate(dateKey) {
  return `mission-26c-90m-${dateKey}`;
}

/** 오늘 미션의 보상 여부를 확인하는 날짜 기반 식별자를 만듭니다. */
function getTodayMissionRewardId() {
  return getMissionRewardIdForDate(getLocalDateKey());
}

/** 현재 필터에 맞는 포인트 거래 카드를 안전한 DOM 요소로 만들어 표시합니다. */
function renderPointTransactions() {
  const filteredTransactions = walletState.transactions.filter(
    (transaction) => activePointFilter === "all" || transaction.type === activePointFilter,
  );
  filteredTransactions.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

  pointTransactionList.replaceChildren();
  pointHistoryCount.textContent = `${filteredTransactions.length}건`;
  pointEmptyState.hidden = filteredTransactions.length > 0;

  filteredTransactions.forEach((transaction) => {
    const transactionItem = document.createElement("article");
    const transactionIcon = document.createElement("span");
    const transactionCopy = document.createElement("div");
    const transactionTitle = document.createElement("strong");
    const transactionDescription = document.createElement("span");
    const transactionValue = document.createElement("div");
    const transactionAmount = document.createElement("strong");
    const transactionDate = document.createElement("time");

    transactionItem.className = `point-transaction is-${transaction.type}`;
    transactionIcon.className = "transaction-icon";
    transactionCopy.className = "transaction-copy";
    transactionValue.className = "transaction-value";

    transactionIcon.textContent = transaction.type === "earn" ? "+" : "−";
    transactionTitle.textContent = transaction.title;
    transactionDescription.textContent = transaction.description;
    transactionAmount.textContent = `${transaction.amount > 0 ? "+" : "−"}${formatPointNumber(
      Math.abs(transaction.amount),
    )} P`;
    transactionDate.dateTime = transaction.createdAt;
    transactionDate.textContent = formatTransactionDate(transaction.createdAt);

    transactionCopy.append(transactionTitle, transactionDescription);
    transactionValue.append(transactionAmount, transactionDate);
    transactionItem.append(transactionIcon, transactionCopy, transactionValue);
    pointTransactionList.append(transactionItem);
  });
}

/** 지갑 잔액, 누적 적립·사용 합계, 미션 보상 상태를 한 번에 갱신합니다. */
function renderWallet() {
  const { totalEarned, totalUsed } = getWalletStats();
  const rewardWasPaid = walletState.awardedMissionIds.includes(getTodayMissionRewardId());

  walletBalance.textContent = formatPointNumber(walletState.balance);
  walletTotalEarned.textContent = formatPointNumber(totalEarned);
  walletTotalUsed.textContent = formatPointNumber(totalUsed);
  walletMissionRewardStatus.textContent = rewardWasPaid ? "오늘 미션 보상 지급 완료" : "오늘 미션 보상 대기";

  pointFilterButtons.forEach((button) => {
    const isActive = button.dataset.pointFilter === activePointFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  renderPointTransactions();
  renderMyPage();
}

/** 선택된 카테고리에 맞춰 리워드 상품 카드를 생성합니다. */
function renderRewardProducts() {
  const visibleProducts = rewardProducts.filter(
    (product) => activeRewardCategory === "all" || product.category === activeRewardCategory,
  );

  rewardProductGrid.replaceChildren();
  rewardProductCount.textContent = `${visibleProducts.length}개 상품`;

  rewardCategoryButtons.forEach((button) => {
    const isActive = button.dataset.rewardCategory === activeRewardCategory;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  visibleProducts.forEach((product) => {
    const card = document.createElement("article");
    const button = document.createElement("button");
    const visual = document.createElement("div");
    const emoji = document.createElement("span");
    const category = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const priceRow = document.createElement("div");
    const price = document.createElement("strong");
    const arrow = document.createElement("span");

    card.className = "reward-product-card";
    button.className = "reward-product-button";
    button.type = "button";
    button.dataset.rewardProductId = product.id;
    button.setAttribute("aria-label", `${product.name} 상세 보기`);
    visual.className = "reward-product-visual";
    visual.dataset.productTone = product.tone;
    emoji.className = "reward-product-emoji";
    category.className = "reward-card-category";
    copy.className = "reward-product-copy";
    priceRow.className = "reward-product-price";

    emoji.textContent = product.emoji;
    category.textContent = product.category;
    title.textContent = product.name;
    description.textContent = product.description;
    price.textContent = `${formatPointNumber(product.price)} P`;
    arrow.textContent = ">";

    visual.append(emoji, category);
    priceRow.append(price, arrow);
    copy.append(title, description, priceRow);
    button.append(visual, copy);
    card.append(button);
    rewardProductGrid.append(card);

    button.addEventListener("click", () => openRewardProductDetail(product.id));
  });
}

/** 저장된 구매내역을 최신순으로 렌더링합니다. */
function renderRewardOrders() {
  const orders = [...walletState.orders].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
  );

  rewardOrderList.replaceChildren();
  rewardOrderCount.textContent = `${orders.length}건`;
  rewardOrderEmpty.hidden = orders.length > 0;

  orders.forEach((order) => {
    const product = rewardProducts.find((item) => item.id === order.productId);
    const item = document.createElement("article");
    const emoji = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const category = document.createElement("span");
    const value = document.createElement("div");
    const amount = document.createElement("strong");
    const orderDate = document.createElement("time");

    item.className = "reward-order-item";
    emoji.className = "reward-order-emoji";
    copy.className = "reward-order-copy";
    value.className = "reward-order-value";

    emoji.textContent = product?.emoji || "🎁";
    title.textContent = order.productName;
    category.textContent = `${order.category} · 구매 완료`;
    amount.textContent = `−${formatPointNumber(order.points)} P`;
    orderDate.dateTime = order.createdAt;
    orderDate.textContent = formatTransactionDate(order.createdAt);

    copy.append(title, category);
    value.append(amount, orderDate);
    item.append(emoji, copy, value);
    rewardOrderList.append(item);
  });
}

/** 리워드 잔액, 카테고리 상품, 구매내역을 현재 지갑 상태로 갱신합니다. */
function renderRewardShop() {
  rewardWalletBalance.textContent = formatPointNumber(walletState.balance);
  rewardDetailBalance.textContent = formatPointNumber(walletState.balance);
  renderRewardProducts();
  renderRewardOrders();
}

/** 상품 카드를 눌렀을 때 상세 다이얼로그를 초기 상태로 엽니다. */
function openRewardProductDetail(productId) {
  const product = rewardProducts.find((item) => item.id === productId);
  if (!product) return;

  selectedRewardProductId = product.id;
  rewardDetailVisual.dataset.productTone = product.tone;
  rewardDetailEmoji.textContent = product.emoji;
  rewardDetailCategory.textContent = product.category;
  rewardDetailTitle.textContent = product.name;
  rewardDetailDescription.textContent = product.detail;
  rewardDetailPrice.textContent = formatPointNumber(product.price);
  rewardDetailBalance.textContent = formatPointNumber(walletState.balance);
  rewardDetailDialog.classList.remove("has-error");
  rewardPurchaseFeedback.hidden = true;
  rewardPurchaseButton.disabled = false;
  rewardPurchaseButton.textContent = "포인트로 구매하기";

  if (typeof rewardDetailDialog.showModal === "function") {
    rewardDetailDialog.showModal();
  } else {
    rewardDetailDialog.setAttribute("open", "");
  }
}

/** 상품 상세 다이얼로그를 닫고 선택 상태를 정리합니다. */
function closeRewardProductDetail() {
  if (typeof rewardDetailDialog.close === "function") {
    rewardDetailDialog.close();
  } else {
    rewardDetailDialog.removeAttribute("open");
  }
  selectedRewardProductId = null;
}

/**
 * 선택한 상품을 포인트로 구매합니다.
 * 잔액이 부족하면 아무 데이터도 바꾸지 않고 Red 경고만 표시합니다.
 */
async function purchaseSelectedReward() {
  const product = rewardProducts.find((item) => item.id === selectedRewardProductId);
  if (!product) return;
  if (!requireAuthenticatedUser("로그인 후 GREEN REWARD를 구매할 수 있어요.")) return;

  if (walletState.balance < product.price) {
    const shortage = product.price - walletState.balance;
    rewardDetailDialog.classList.add("has-error");
    rewardPurchaseFeedback.hidden = false;
    rewardPurchaseFeedbackIcon.textContent = "!";
    rewardPurchaseFeedbackTitle.textContent = "포인트가 부족해요";
    rewardPurchaseFeedbackMessage.textContent = `${formatPointNumber(shortage)} P를 더 모으면 구매할 수 있어요.`;
    showToast("포인트가 부족해요. 미션으로 GREEN POINT를 더 모아 주세요.", "danger");
    return;
  }

  rewardPurchaseButton.disabled = true;
  rewardPurchaseButton.textContent = "구매 처리 중...";

  const { error } = await greenOnSupabase
    .from("reward_orders")
    .insert({
      user_id: authState.account.userId,
      reward_id: product.id,
    })
    .select("id")
    .single();

  if (error) {
    const isInsufficient = error.message.includes("insufficient_points");
    const isOutOfStock = error.message.includes("reward_out_of_stock");
    rewardDetailDialog.classList.add("has-error");
    rewardPurchaseFeedback.hidden = false;
    rewardPurchaseFeedbackIcon.textContent = "!";
    rewardPurchaseFeedbackTitle.textContent = isOutOfStock ? "상품 재고가 없어요" : "구매를 완료하지 못했어요";
    rewardPurchaseFeedbackMessage.textContent = isInsufficient
      ? "다른 기기에서 사용한 포인트가 있어 잔액이 부족해요. 지갑을 새로 확인해 주세요."
      : isOutOfStock
        ? "다른 상품을 선택해 주세요."
        : "잠시 후 다시 시도해 주세요.";
    rewardPurchaseButton.disabled = false;
    rewardPurchaseButton.textContent = "포인트로 구매하기";
    showToast(isInsufficient ? "포인트가 부족해요." : "상품 구매에 실패했어요.", "danger");

    if (isInsufficient) await loadSupabaseData(authState.account.userId);
    return;
  }

  await loadSupabaseData(authState.account.userId);

  rewardDetailDialog.classList.remove("has-error");
  rewardPurchaseFeedback.hidden = false;
  rewardPurchaseFeedbackIcon.textContent = "✓";
  rewardPurchaseFeedbackTitle.textContent = "구매가 완료됐어요";
  rewardPurchaseFeedbackMessage.textContent = `${formatPointNumber(product.price)} P가 차감되고 구매내역에 저장됐어요.`;
  rewardPurchaseButton.disabled = true;
  rewardPurchaseButton.textContent = "구매 완료";
  rewardDetailBalance.textContent = formatPointNumber(walletState.balance);
  showToast(`${product.name} 구매 완료! ${formatPointNumber(product.price)} P를 사용했어요.`);
}

/**
 * 선택한 가상 에어컨 데이터를 상태 카드에 반영합니다.
 * 경고 또는 오류일 때만 is-danger 클래스를 붙여 Red UI가 나타나도록 합니다.
 * @param {string} scenarioName airconScenarios에 정의된 시나리오 이름
 */
function renderAirconScenario(scenarioName) {
  const scenario = airconScenarios[scenarioName] || airconScenarios.normal;
  currentAirconScenarioName = airconScenarios[scenarioName] ? scenarioName : "normal";

  Object.entries(scenario).forEach(([fieldName, value]) => {
    const field = airconStatusCard.querySelector(`[data-aircon-field="${fieldName}"]`);

    if (field) {
      field.textContent = fieldName === "filter" ? `${value}%` : value;
    }
  });

  airconStatusCard.classList.toggle("is-danger", scenario.tone === "danger");
  airconStatusCard.classList.toggle("is-off", scenario.tone === "off");

  // 필터 막대의 길이와 접근성 값을 데이터에 맞게 함께 갱신합니다.
  filterProgressBar.style.width = `${scenario.filter}%`;
  filterProgress.setAttribute("aria-valuenow", String(scenario.filter));

  airconScenarioButtons.forEach((button) => {
    const isSelected = button.dataset.airconScenario === scenarioName;
    const isDangerSelected = isSelected && scenario.tone === "danger";

    button.classList.toggle("is-selected", isSelected && !isDangerSelected);
    button.classList.toggle("is-danger-selected", isDangerSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  // 에어컨 상태가 바뀌면 미션 화면의 실시간 성공 조건도 함께 갱신합니다.
  refreshMissionConditions();
}

/** 화면에서 선택한 가상 에어컨 상태를 로그인 사용자의 aircon_status 행에 저장합니다. */
async function saveAirconScenario(scenarioName) {
  if (!isAuthenticated()) return;

  const databaseScenarios = {
    normal: {
      power_on: true,
      mode: "cool",
      set_temperature: 26,
      fan_mode: "auto",
      usage_minutes: 150,
      filter_life: 82,
      sensor_status: "normal",
      status_tone: "normal",
    },
    eco: {
      power_on: true,
      mode: "cool",
      set_temperature: 27,
      fan_mode: "auto",
      usage_minutes: 60,
      filter_life: 82,
      sensor_status: "normal",
      status_tone: "normal",
    },
    filter: {
      power_on: true,
      mode: "cool",
      set_temperature: 24,
      fan_mode: "high",
      usage_minutes: 7680,
      filter_life: 12,
      sensor_status: "normal",
      status_tone: "danger",
    },
    sensor: {
      power_on: true,
      mode: "error",
      set_temperature: null,
      fan_mode: "stopped",
      usage_minutes: 70,
      filter_life: 78,
      sensor_status: "error",
      status_tone: "danger",
    },
    off: {
      power_on: false,
      mode: "standby",
      set_temperature: null,
      fan_mode: "stopped",
      usage_minutes: 0,
      filter_life: 82,
      sensor_status: "normal",
      status_tone: "off",
    },
  };

  const { error } = await greenOnSupabase
    .from("aircon_status")
    .update(databaseScenarios[scenarioName] ?? databaseScenarios.normal)
    .eq("user_id", authState.account.userId);

  if (error) {
    console.error("가상 에어컨 상태 저장에 실패했습니다.", error);
    showToast("에어컨 상태를 저장하지 못했어요.", "danger");
  }
}

/**
 * 현재 가상 에어컨 데이터가 오늘의 미션 조건을 충족하는지 계산합니다.
 * 화면 표시와 +30분 판정이 같은 결과를 사용하도록 한 곳에서 조건을 관리합니다.
 * @returns {Record<string, {met: boolean, value: string}>} 조건별 충족 여부와 안내 문구
 */
function getMissionConditions() {
  const scenario = airconScenarios[currentAirconScenarioName];
  const numericTemperature = Number.parseInt(scenario.temperature, 10);
  const targetTemperature = Number(missionDefinition?.target_temperature ?? 26);
  const sensorIsNormal = currentAirconScenarioName !== "sensor";

  return {
    power: {
      met: scenario.power === "ON",
      value: `ON 필요 · 현재 ${scenario.power}`,
    },
    mode: {
      met: scenario.mode === "냉방",
      value: `냉방 필요 · 현재 ${scenario.mode}`,
    },
    temperature: {
      met: Number.isFinite(numericTemperature) && numericTemperature >= targetTemperature,
      value: `${formatWeatherNumber(targetTemperature)}°C 이상 · 현재 ${scenario.temperature}`,
    },
    sensor: {
      met: sensorIsNormal,
      value: `정상 연결 필요 · 현재 ${sensorIsNormal ? "정상" : "오류"}`,
    },
  };
}

/**
 * 성공 조건 목록을 현재 에어컨 상태에 맞춰 Blue 또는 Red로 표시합니다.
 * @returns {boolean} 모든 미션 조건이 충족되었는지 여부
 */
function refreshMissionConditions() {
  const conditions = getMissionConditions();

  missionConditionItems.forEach((item) => {
    const condition = conditions[item.dataset.missionCondition];
    const icon = item.querySelector(".condition-icon");
    const value = item.querySelector("[data-condition-value]");
    const result = item.querySelector(".condition-result");

    item.classList.toggle("is-met", condition.met);
    item.classList.toggle("is-unmet", !condition.met);
    icon.textContent = condition.met ? "✓" : "!";
    value.textContent = condition.value;
    result.textContent = condition.met ? "충족" : "위반";
  });

  return Object.values(conditions).every((condition) => condition.met);
}

/** Supabase 미션 기준값을 제목, 설명, 보상, 목표 시간 UI에 반영합니다. */
function renderMissionDefinition() {
  if (!missionDefinition) return;

  missionCardTitle.textContent = missionDefinition.title;
  missionDescription.textContent = missionDefinition.description;
  missionRewardPoints.textContent = `+${formatPointNumber(missionDefinition.reward_points)} P`;
  walletMissionRewardPoints.textContent = `미션 성공 시 +${formatPointNumber(missionDefinition.reward_points)} P`;
  missionTargetMinutes.textContent = String(missionDefinition.target_minutes);
  missionProgress.setAttribute("aria-valuemax", String(missionDefinition.target_minutes));
  refreshMissionConditions();
}

/**
 * 참여 전, 진행 중, 경고, 성공, 실패 상태에 맞게 미션 UI 전체를 갱신합니다.
 */
function renderMissionState() {
  const targetMinutes = missionDefinition?.target_minutes ?? 90;
  const rewardPoints = missionDefinition?.reward_points ?? 100;
  const statusContent = {
    available: {
      chip: "참여 전",
      symbol: "→",
      title: "미션 참여를 기다리고 있어요",
      message: "아래 참여 버튼을 누르면 조건 확인을 시작해요.",
    },
    active: {
      chip: "진행 중",
      symbol: "+",
      title: missionState.elapsedMinutes
        ? `${missionState.elapsedMinutes}분 동안 조건을 지켰어요`
        : "미션을 시작했어요",
      message: "현재 조건을 확인하고 시간을 30분씩 진행해 보세요.",
    },
    warning: {
      chip: "조건 경고",
      symbol: "!",
      title: "미션 조건이 지켜지지 않았어요",
      message: "정상 조건으로 바꿔 주세요. 연속으로 한 번 더 위반하면 실패해요.",
    },
    success: {
      chip: "미션 성공",
      symbol: "✓",
      title: `${targetMinutes}분 친환경 냉방에 성공했어요!`,
      message: missionState.rewardAwarded
        ? `GREEN POINT ${formatPointNumber(rewardPoints)}P가 지갑에 안전하게 지급됐어요.`
        : "오늘 미션 보상은 이미 지급되어 중복 적립되지 않았어요.",
    },
    failed: {
      chip: "미션 실패",
      symbol: "!",
      title: "조건 위반이 연속으로 확인됐어요",
      message: "에어컨을 정상 상태로 바꾼 뒤 다시 도전해 보세요.",
    },
  }[missionState.status];

  const progressPercent = Math.min(100, Math.round((missionState.elapsedMinutes / targetMinutes) * 100));
  const isRunning = missionState.status === "active" || missionState.status === "warning";
  const isFinished = missionState.status === "success" || missionState.status === "failed";

  missionCard.dataset.missionState = missionState.status;
  missionStateChip.textContent = statusContent.chip;
  missionStatusSymbol.textContent = statusContent.symbol;
  missionStatusTitle.textContent = statusContent.title;
  missionStatusMessage.textContent = statusContent.message;
  missionElapsed.textContent = String(missionState.elapsedMinutes);
  missionProgressBar.style.width = `${progressPercent}%`;
  missionProgress.setAttribute("aria-valuenow", String(missionState.elapsedMinutes));

  missionStartButton.hidden = missionState.status !== "available";
  missionAdvanceButton.hidden = isFinished;
  missionAdvanceButton.disabled = !isRunning;
  missionRetryButton.hidden = missionState.status !== "failed";
  missionWalletButton.hidden = missionState.status !== "success";
  missionRewardLabel.textContent =
    missionState.status === "success"
      ? missionState.rewardAwarded
        ? "보상 지급 완료"
        : "오늘 지급 완료"
      : "성공 보상";

  refreshMissionConditions();
}

/** 미션 참여 또는 재도전 기록을 Supabase에 생성·초기화합니다. */
async function startMission() {
  if (!requireAuthenticatedUser("로그인 후 GREEN MISSION에 참여할 수 있어요.")) return;
  if (!missionDefinition) {
    showToast("오늘의 미션 정보를 불러오지 못했어요.", "danger");
    return;
  }

  missionStartButton.disabled = true;
  missionRetryButton.disabled = true;

  const request = currentUserMissionId
    ? greenOnSupabase
        .from("user_missions")
        .update({
          status: "active",
          elapsed_minutes: 0,
          consecutive_violations: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
        })
        .eq("id", currentUserMissionId)
    : greenOnSupabase.from("user_missions").insert({
        user_id: authState.account.userId,
        mission_id: missionDefinition.id,
      });

  const { data, error } = await request.select("*").single();
  missionStartButton.disabled = false;
  missionRetryButton.disabled = false;

  if (error) {
    console.error("미션 참여 기록 저장에 실패했습니다.", error);
    showToast("미션 참여를 저장하지 못했어요.", "danger");
    return;
  }

  applyUserMissionRow(data);
  renderMissionState();
  showToast("GREEN MISSION에 참여했어요. 현재 조건을 확인해 주세요!");
}

/**
 * 가상 시간을 30분 진행하며 현재 에어컨 상태로 미션을 판정합니다.
 * 첫 연속 위반은 경고, 두 번째 연속 위반은 실패로 처리합니다.
 */
async function advanceMissionTime() {
  if (missionState.status !== "active" && missionState.status !== "warning") {
    return;
  }
  if (!requireAuthenticatedUser() || !currentUserMissionId) return;

  const targetMinutes = missionDefinition?.target_minutes ?? 90;
  const rewardPoints = missionDefinition?.reward_points ?? 100;
  const allConditionsMet = refreshMissionConditions();
  const nextViolations = allConditionsMet ? 0 : missionState.consecutiveViolations + 1;
  const nextElapsed = allConditionsMet
    ? Math.min(missionState.elapsedMinutes + 30, targetMinutes)
    : missionState.elapsedMinutes;
  const requestedStatus = allConditionsMet
    ? nextElapsed >= targetMinutes
      ? "success"
      : "active"
    : nextViolations >= 2
      ? "failed"
      : "warning";

  missionAdvanceButton.disabled = true;
  const { data, error } = await greenOnSupabase
    .from("user_missions")
    .update({
      status: requestedStatus,
      elapsed_minutes: nextElapsed,
      consecutive_violations: nextViolations,
      completed_at: requestedStatus === "success" || requestedStatus === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", currentUserMissionId)
    .select("*")
    .single();

  if (error) {
    console.error("미션 진행 기록 저장에 실패했습니다.", error);
    missionAdvanceButton.disabled = false;
    showToast("미션 진행을 저장하지 못했어요.", "danger");
    return;
  }

  applyUserMissionRow(data);
  await loadSupabaseData(authState.account.userId);

  if (missionState.status === "success") {
    showToast(
      `미션 성공! GREEN POINT ${formatPointNumber(rewardPoints)}P가 Supabase 지갑에 지급됐어요.`,
    );
  } else if (missionState.status === "failed") {
    showToast("미션 실패: 조건 위반이 연속으로 확인됐어요.", "danger");
  } else if (missionState.status === "warning") {
    showToast("미션 조건 위반: 정상 상태로 바꾼 뒤 다시 진행해 주세요.", "danger");
  } else {
    showToast(`미션 진행 중: ${missionState.elapsedMinutes} / ${targetMinutes}분`);
  }
}

/**
 * 사용자가 선택한 메뉴의 화면만 표시합니다.
 * 이후 단계에서 각 화면에 기능을 추가해도 이 공통 전환 로직은 그대로 사용할 수 있습니다.
 * @param {string} viewName 표시할 화면 이름
 * @param {boolean} updateHash 주소의 해시도 함께 바꿀지 여부
 */
function changeView(viewName, updateHash = true) {
  const targetPanel = document.querySelector(`[data-view-panel="${viewName}"]`);

  // 존재하지 않는 화면 이름이 들어오면 안전하게 홈 화면을 표시합니다.
  const safeViewName = targetPanel ? viewName : "home";

  viewPanels.forEach((panel) => {
    const isTarget = panel.dataset.viewPanel === safeViewName;
    panel.hidden = !isTarget;
    panel.classList.toggle("is-active", isTarget);
  });

  navigationItems.forEach((item) => {
    const isTarget = item.dataset.view === safeViewName;
    item.classList.toggle("is-active", isTarget);

    // 현재 위치를 보조기기에도 알릴 수 있도록 aria-current를 관리합니다.
    if (isTarget) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  if (updateHash) {
    window.history.replaceState(null, "", `#${safeViewName}`);
  }

  // 새 화면이 열릴 때 항상 상단부터 볼 수 있게 이동합니다.
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 화면 아래쪽에 짧은 안내 메시지를 표시합니다.
 * 연속으로 눌러도 타이머가 겹치지 않도록 기존 타이머를 먼저 지웁니다.
 * @param {string} message 사용자에게 보여 줄 문장
 * @param {"normal" | "danger"} tone 일반 안내 또는 Red 경고 색상
 */
function showToast(message, tone = "normal") {
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.classList.toggle("is-danger", tone === "danger");
  toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

// 하단 메뉴를 누르면 해당 화면으로 전환합니다.
navigationItems.forEach((item) => {
  item.addEventListener("click", () => {
    changeView(item.dataset.view);
  });
});

// 홈 카드나 빈 화면의 버튼도 같은 화면 전환 함수를 사용합니다.
internalMoveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    changeView(button.dataset.goTo);
  });
});

// 시뮬레이션 버튼을 누르면 해당 가상 IoT 데이터를 즉시 화면에 반영합니다.
airconScenarioButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const scenarioName = button.dataset.airconScenario;
    const selectedScenario = airconScenarios[scenarioName];

    renderAirconScenario(scenarioName);
    await saveAirconScenario(scenarioName);

    if (selectedScenario.tone === "danger") {
      showToast(`${selectedScenario.statusLabel}: 에어컨 상태를 확인해 주세요.`, "danger");
    } else {
      showToast(`${selectedScenario.statusLabel} 상태로 변경했어요.`);
    }
  });
});

// 미션 참여, 시간 진행, 재도전 버튼을 각각의 상태 처리 함수와 연결합니다.
missionStartButton.addEventListener("click", startMission);
missionAdvanceButton.addEventListener("click", advanceMissionTime);
missionRetryButton.addEventListener("click", startMission);

// 지갑의 전체·적립·사용 탭은 데이터는 유지하고 표시할 거래 종류만 바꿉니다.
pointFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activePointFilter = button.dataset.pointFilter;
    renderWallet();
  });
});

// 리워드 카테고리 탭은 선택한 종류의 상품만 다시 그립니다.
rewardCategoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeRewardCategory = button.dataset.rewardCategory;
    renderRewardShop();
  });
});

rewardDialogCloseButton.addEventListener("click", closeRewardProductDetail);
rewardPurchaseButton.addEventListener("click", purchaseSelectedReward);

// 다이얼로그 바깥의 어두운 배경을 누른 경우에도 상세 창을 닫습니다.
rewardDetailDialog.addEventListener("click", (event) => {
  if (event.target === rewardDetailDialog) {
    closeRewardProductDetail();
  }
});

rewardDetailDialog.addEventListener("close", () => {
  selectedRewardProductId = null;
});

// MY 화면의 로그인·회원가입 버튼은 요청한 탭을 바로 열어 줍니다.
authOpenButtons.forEach((button) => {
  button.addEventListener("click", () => openAuthDialog(button.dataset.authOpen));
});

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authDialogCloseButton.addEventListener("click", closeAuthDialog);
loginForm.addEventListener("submit", handleLogin);
signupForm.addEventListener("submit", handleSignup);
logoutButton.addEventListener("click", handleLogout);

// 회원 다이얼로그 바깥 배경을 눌러도 자연스럽게 닫히도록 합니다.
authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) {
    closeAuthDialog();
  }
});

authDialog.addEventListener("close", clearAuthErrors);

// PHASE 1에서는 실제 알림 데이터가 없으므로 안내 메시지만 보여 줍니다.
notificationButton.addEventListener("click", () => {
  showToast("새로운 알림은 아직 없어요. 곧 반가운 소식을 전할게요!");
});

// 사용자가 원할 때 같은 공식 API를 다시 호출해 최신 날씨와 추천 미션을 갱신합니다.
weatherRefreshButton.addEventListener("click", loadCurrentWeather);

// 새로고침했을 때 주소에 적힌 화면을 복원합니다. 알 수 없는 값이면 홈으로 이동합니다.
const initialView = window.location.hash.replace("#", "") || "home";
changeView(initialView, false);

// 페이지가 처음 열릴 때는 정상 운전 시뮬레이션 데이터를 표시합니다.
renderAirconScenario("normal");

// 샘플 날씨를 즉시 보여 준 뒤 공식 API 응답이 오면 실시간 데이터로 교체합니다.
renderWeather(SAMPLE_WEATHER, {
  source: "sample",
  statusMessage: "샘플 날씨를 먼저 표시하고 실시간 API를 확인하고 있어요.",
});
loadCurrentWeather();

// 오늘 날짜와 최초 미션 상태를 화면에 표시합니다.
missionDate.textContent = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short",
}).format(new Date());
renderMissionState();
renderWallet();
renderRewardShop();

// 마지막으로 Supabase의 실제 로그인 세션을 확인해 MY 화면을 복원합니다.
initializeSupabaseAuth().catch((error) => {
  console.error("Supabase Auth 초기화에 실패했습니다.", error);
  authStorageNotice.textContent = "Supabase 인증을 시작하지 못했습니다. 잠시 후 새로고침해 주세요.";
  authStorageNotice.closest(".my-data-notice")?.classList.add("is-danger");
});
