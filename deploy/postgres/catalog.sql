-- Minimal public reference data for a new Titop Arenda installation.
-- Listings, users, bookings, and reviews are intentionally not seeded.

INSERT INTO house_category (name, deleted, created_at, updated_at)
SELECT category_name, false, now(), now()
FROM (VALUES
  ('Квартира'),
  ('Студия'),
  ('Апартаменты'),
  ('Дом'),
  ('Коттедж'),
  ('Комната')
) AS catalog(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM house_category existing WHERE existing.name = catalog.category_name
);

INSERT INTO service (name, deleted, created_at, updated_at)
SELECT service_name, false, now(), now()
FROM (VALUES
  ('Wi-Fi'),
  ('Телевизор'),
  ('Кондиционер'),
  ('Холодильник'),
  ('Стиральная машина'),
  ('Микроволновая печь'),
  ('Плита'),
  ('Посуда'),
  ('Парковка'),
  ('Лифт'),
  ('Балкон'),
  ('Душ'),
  ('Ванна')
) AS catalog(service_name)
WHERE NOT EXISTS (
  SELECT 1 FROM service existing WHERE existing.name = catalog.service_name
);
