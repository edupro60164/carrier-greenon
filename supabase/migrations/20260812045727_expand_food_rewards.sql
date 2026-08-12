-- 2026-08-12 온라인 판매가를 참고해 1 GREEN POINT ≈ 10원으로 환산한 교육용 리워드입니다.
-- 실제 매장·지역·프로모션에 따라 가격은 달라질 수 있으며 상품 발송은 시뮬레이션으로만 처리합니다.

insert into public.rewards (
  code,
  category,
  name,
  description,
  detail,
  price_points,
  emoji,
  tone,
  is_active,
  stock
)
values
  ('food_iced_americano', 'FOOD', '아이스 아메리카노', '시원한 아이스 아메리카노 한 잔', '스타벅스 카페 아메리카노 Tall 4,700원 판매가를 기준으로 환산한 가상 모바일 쿠폰입니다.', 470, '☕', 'sky', true, null),
  ('food_shin_ramyun', 'FOOD', '신라면 큰사발', '미션 뒤 든든하게 즐기는 매콤한 라면', '편의점 큰사발면 약 1,500원 판매가를 기준으로 환산한 가상 모바일 쿠폰입니다.', 150, '🍜', 'orange', true, null),
  ('food_glazed_donut', 'FOOD', '글레이즈드 도넛', '달콤하고 폭신한 도넛 한 개', '던킨 글레이즈드 묶음 판매가와 일반 단품가를 참고해 정한 가상 모바일 쿠폰입니다.', 160, '🍩', 'purple', true, null),
  ('food_tteokbokki', 'FOOD', '매콤 떡볶이 1인분', '쫄깃하고 기분 좋은 매콤함', '일반 분식점 떡볶이 1인분 약 5,000원을 기준으로 환산한 가상 모바일 쿠폰입니다.', 500, '🥘', 'orange', true, null),
  ('food_cheese_pizza', 'FOOD', '치즈 피자 M', '친구와 함께 나누는 고소한 치즈 피자', '도미노 치즈 피자 M 16,500원 판매가를 기준으로 환산한 가상 모바일 쿠폰입니다.', 1650, '🍕', 'orange', true, null),
  ('food_single_icecream', 'FOOD', '싱글 아이스크림', '상쾌한 미션 성공을 축하하는 한 스쿱', '배스킨라빈스 싱글레귤러 3,900원 판매가를 기준으로 환산한 가상 모바일 쿠폰입니다.', 390, '🍨', 'sky', true, null),
  ('food_fresh_bread', 'FOOD', '오늘의 갓구운 빵', '가까운 베이커리에서 고르는 빵 한 개', '국내 베이커리 단품 빵의 일반적인 판매가를 참고해 2,500원 상당으로 정한 가상 모바일 쿠폰입니다.', 250, '🥐', 'orange', true, null),
  ('food_sparkling_water', 'FOOD', '청량 탄산수', '무더운 날 가볍게 즐기는 탄산수', '편의점 탄산수 한 병의 일반적인 판매가를 참고해 1,800원 상당으로 정한 가상 모바일 쿠폰입니다.', 180, '🫧', 'mint', true, null),
  ('food_fruit_cup', 'FOOD', '시원한 과일컵', '제철 과일을 담은 상큼한 간식', '카페·편의점 과일컵의 일반적인 판매가를 참고해 4,500원 상당으로 정한 가상 모바일 쿠폰입니다.', 450, '🍉', 'green', true, null),
  ('food_vegan_cookie', 'FOOD', '비건 오트 쿠키', '식물성 재료로 만든 든든한 간식', '환경을 생각한 비건 오트 쿠키 한 개를 3,000원 상당으로 정한 가상 모바일 쿠폰입니다.', 300, '🍪', 'green', true, null)
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  detail = excluded.detail,
  price_points = excluded.price_points,
  emoji = excluded.emoji,
  tone = excluded.tone,
  is_active = excluded.is_active,
  stock = excluded.stock,
  updated_at = now();
