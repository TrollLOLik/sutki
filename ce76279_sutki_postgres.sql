-- Converted PostgreSQL Database Schema and Data

-- Table structures
CREATE TABLE IF NOT EXISTS admin_story (
  id SERIAL,
  admin_id integer NOT NULL,
  category_id integer DEFAULT NULL,
  service_id integer DEFAULT NULL,
  change_date timestamp NOT NULL,
  type varchar(255)  NOT NULL,
  user_id integer DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS code (
  id SERIAL,
  email varchar(255)  NOT NULL,
  code varchar(6)  NOT NULL,
  date timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS comment (
  id SERIAL,
  owner_id integer NOT NULL,
  house_id integer NOT NULL,
  parent_id integer DEFAULT NULL,
  addressee_id integer DEFAULT NULL,
  body varchar(2000)  NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS doctrine_migration_versions (
  version varchar(191)  NOT NULL,
  executed_at timestamp DEFAULT NULL,
  execution_time integer DEFAULT NULL,
  PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS file (
  id SERIAL,
  house_id integer DEFAULT NULL,
  name varchar(255)  NOT NULL,
  size integer DEFAULT NULL,
  format varchar(255)  NOT NULL,
  dir varchar(255)  DEFAULT NULL,
  path varchar(1200)  NOT NULL,
  deleted boolean NOT NULL,
  position integer NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS guest (
  id SERIAL,
  guest_id integer NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house (
  id SERIAL,
  owner_id integer NOT NULL,
  street varchar(255)  NOT NULL,
  description varchar(5005)  NOT NULL,
  price integer NOT NULL,
  deleted boolean NOT NULL,
  count_room varchar(255)  NOT NULL,
  status varchar(255)  NOT NULL DEFAULT 'new',
  country varchar(255)  NOT NULL DEFAULT 'Магнитогорск',
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  views integer NOT NULL DEFAULT '0',
  last_date_view timestamp DEFAULT NULL,
  views_current_day integer DEFAULT NULL,
  date_top timestamp DEFAULT NULL,
  pay boolean NOT NULL DEFAULT false,
  house_number varchar(50)  NOT NULL,
  area integer NOT NULL,
  number_room varchar(100)  DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house_category (
  id SERIAL,
  name varchar(255)  NOT NULL,
  deleted boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house_house_category (
  house_id integer NOT NULL,
  house_category_id integer NOT NULL,
  PRIMARY KEY (house_id, house_category_id)
);

CREATE TABLE IF NOT EXISTS house_house_service (
  house_id integer NOT NULL,
  service_id integer NOT NULL,
  PRIMARY KEY (house_id, service_id)
);

CREATE TABLE IF NOT EXISTS request (
  id SERIAL,
  house_id integer DEFAULT NULL,
  user_id integer DEFAULT NULL,
  name varchar(255)  NOT NULL,
  surname varchar(255)  NOT NULL,
  lastname varchar(255)  NOT NULL,
  count integer NOT NULL,
  message varchar(800)  DEFAULT NULL,
  phone varchar(255)  NOT NULL,
  start_date date NOT NULL,
  end_date date DEFAULT NULL,
  status varchar(255)  NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  confirmed_at timestamp DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  guest_id varchar(255)  DEFAULT NULL,
  email varchar(255)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS request_viewers (
  id SERIAL,
  request_id integer NOT NULL,
  user_id integer DEFAULT NULL,
  guest_id varchar(255)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS review (
  id SERIAL,
  owner_id integer NOT NULL,
  house_id integer NOT NULL,
  body varchar(1500)  NOT NULL,
  rating integer NOT NULL,
  status varchar(255)  NOT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service (
  id SERIAL,
  name varchar(255)  NOT NULL,
  deleted boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS session_ip_address (
  id SERIAL,
  uid varchar(255)  NOT NULL,
  city varchar(255)  NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL,
  name varchar(255)  DEFAULT NULL,
  surname varchar(255)  DEFAULT NULL,
  patronymic varchar(255)  DEFAULT NULL,
  email varchar(255)  NOT NULL,
  password varchar(500)  DEFAULT NULL,
  roles jsonb NOT NULL,
  deleted boolean NOT NULL,
  is_verified boolean NOT NULL,
  google_id varchar(255)  DEFAULT NULL,
  phone varchar(255)  DEFAULT NULL,
  locale varchar(255)  DEFAULT NULL,
  city varchar(255)  DEFAULT NULL,
  enable boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  code varchar(6)  DEFAULT NULL,
  date_code timestamp DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS views (
  id SERIAL,
  value bigint DEFAULT NULL,
  view_date timestamp NOT NULL,
  PRIMARY KEY (id)
);

-- Table indexes
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2642B8210 ON admin_story (admin_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC212469DE2 ON admin_story (category_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2ED5CA9E6 ON admin_story (service_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2A76ED395 ON admin_story (user_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C7E3C61F9 ON comment (owner_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C6BB74515 ON comment (house_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C727ACA70 ON comment (parent_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C2261B4C3 ON comment (addressee_id);
CREATE INDEX IF NOT EXISTS IDX_8C9F36106BB74515 ON file (house_id);
CREATE INDEX IF NOT EXISTS IDX_67D5399D7E3C61F9 ON house (owner_id);
CREATE INDEX IF NOT EXISTS IDX_A2C97DEF6BB74515 ON house_house_category (house_id);
CREATE INDEX IF NOT EXISTS IDX_A2C97DEF6C967117 ON house_house_category (house_category_id);
CREATE INDEX IF NOT EXISTS IDX_B53DD9B46BB74515 ON house_house_service (house_id);
CREATE INDEX IF NOT EXISTS IDX_B53DD9B4ED5CA9E6 ON house_house_service (service_id);
CREATE INDEX IF NOT EXISTS IDX_3B978F9F6BB74515 ON request (house_id);
CREATE INDEX IF NOT EXISTS IDX_3B978F9FA76ED395 ON request (user_id);
CREATE INDEX IF NOT EXISTS IDX_2A28448B427EB8A5 ON request_viewers (request_id);
CREATE INDEX IF NOT EXISTS IDX_2A28448BA76ED395 ON request_viewers (user_id);
CREATE INDEX IF NOT EXISTS IDX_794381C67E3C61F9 ON review (owner_id);
CREATE INDEX IF NOT EXISTS IDX_794381C66BB74515 ON review (house_id);

-- Data inserts
INSERT INTO code (id, email, code, date) VALUES
(7, 'weebwebworks@mail.ru', '635636', '2025-08-07 15:09:48');

INSERT INTO doctrine_migration_versions (version, executed_at, execution_time) VALUES
('DoctrineMigrations\\Version20240520132123', '2024-05-21 18:18:08', 320),
('DoctrineMigrations\\Version20240529141508', '2024-06-04 15:23:56', 77),
('DoctrineMigrations\\Version20240530143027', '2024-06-04 15:23:56', 10),
('DoctrineMigrations\\Version20240603164009', '2024-06-04 15:23:56', 37),
('DoctrineMigrations\\Version20240603173138', '2024-06-04 15:23:56', 35),
('DoctrineMigrations\\Version20240620110250', '2024-06-20 19:59:20', 74),
('DoctrineMigrations\\Version20240630120237', '2024-07-12 21:59:33', 35),
('DoctrineMigrations\\Version20240710163241', '2024-07-12 21:59:33', 3),
('DoctrineMigrations\\Version20250125212426', '2025-04-12 02:31:10', 57),
('DoctrineMigrations\\Version20250429192355', '2025-05-04 01:12:08', 92),
('DoctrineMigrations\\Version20250501153002', '2025-05-04 01:12:08', 187),
('DoctrineMigrations\\Version20250524225626', '2025-06-14 17:33:19', 76),
('DoctrineMigrations\\Version20250525001803', '2025-06-14 17:33:19', 40),
('DoctrineMigrations\\Version20250610140354', '2025-06-14 17:33:19', 70),
('DoctrineMigrations\\Version20250709181834', '2025-07-09 22:17:15', 70),
('DoctrineMigrations\\Version20250820170946', '2025-08-20 20:12:41', 69),
('DoctrineMigrations\\Version20250820172245', '2025-08-20 20:25:06', 56),
('DoctrineMigrations\\Version20250902092319', '2025-09-07 11:50:40', 66),
('DoctrineMigrations\\Version20250902100132', '2025-09-07 11:50:40', 37);

INSERT INTO file (id, house_id, name, size, format, dir, path, deleted, position, created_at, updated_at) VALUES
(68, 29, '1755474701_4b15bab375019b898006ce918751e493.png', NULL, 'png', NULL, '../upload_files/1755474701_4b15bab375019b898006ce918751e493.png', false, 1, '2025-08-18 04:51:41', '2025-08-18 04:51:41'),
(69, 30, '1755708317_52fa13fc8c88e588a060a110661ae95c.jpg', NULL, 'jpg', NULL, '../upload_files/1755708317_52fa13fc8c88e588a060a110661ae95c.jpg', false, 1, '2025-08-20 21:45:17', '2025-08-20 21:45:17'),
(70, 31, '1756114485_7405f47c7b9457e2d0b4a82afa4d1304.jpg', NULL, 'jpg', NULL, '../upload_files/1756114485_7405f47c7b9457e2d0b4a82afa4d1304.jpg', false, 1, '2025-08-25 14:34:45', '2025-08-25 14:34:45'),
(71, 32, '1756114488_9ada9b0da0d27c984b105adf9877b784.jpg', NULL, 'jpg', NULL, '../upload_files/1756114488_9ada9b0da0d27c984b105adf9877b784.jpg', false, 1, '2025-08-25 14:34:48', '2025-08-25 14:34:48'),
(72, 33, '1756116881_3e59750432483f5edf40c3cb3cf72e02.PNG', NULL, 'jpg', NULL, '../upload_files/1756116881_3e59750432483f5edf40c3cb3cf72e02.PNG', false, 1, '2025-08-25 15:14:41', '2025-08-25 15:14:41'),
(74, 35, '1758116604_eb3ecfe474f5b5bfb78949b42f0314b2.jpg', NULL, 'jpg', NULL, '../upload_files/1758116604_eb3ecfe474f5b5bfb78949b42f0314b2.jpg', false, 2, '2025-09-17 18:43:24', '2025-09-17 18:43:24'),
(75, 34, '1760608210_30040b86f38263abbaa84e8c462c6df7.jpg', NULL, 'jpg', NULL, '../upload_files/1760608210_30040b86f38263abbaa84e8c462c6df7.jpg', false, 1, '2025-10-16 14:50:10', '2025-10-16 14:50:10');

INSERT INTO house (id, owner_id, street, description, price, deleted, count_room, status, country, created_at, updated_at, views, last_date_view, views_current_day, date_top, pay, house_number, area, number_room, rejection_reason) VALUES
(29, 2, 'Коробова', '132', 132, true, '1', 'new', 'Магнитогорск', '2025-08-18 04:51:41', '2025-10-01 21:43:11', 15, '2025-09-19 13:42:47', 1, '2025-08-25 15:11:24', true, '12', 12, '2', NULL),
(30, 2, 'Коробова', '132', 123, false, '2', 'active', 'Магнитогорск', '2025-08-20 21:45:17', '2026-04-28 12:45:14', 21, '2026-04-28 12:45:14', 1, '2025-08-25 15:12:42', true, '12', 12, '', NULL),
(31, 2, 'Коробова', '123', 2222, false, '2', 'cancel', 'Магнитогорск', '2025-08-25 14:34:45', '2025-09-17 19:08:16', 9, '2025-09-17 19:08:16', 1, '2025-08-25 14:59:10', true, '12', 213, '12', NULL),
(32, 2, 'Коробова', '123', 2222, false, '2', 'cancel', 'Магнитогорск', '2025-08-25 14:34:48', '2025-09-14 14:20:38', 9, '2025-09-12 03:42:11', 1, '2025-08-25 15:12:05', true, '12', 213, '12', NULL),
(33, 2, 'Коробова ', '5', 1000, false, '5', 'cancel', 'Магнитогорск', '2025-08-25 15:14:41', '2025-09-18 10:06:23', 6, '2025-09-18 10:06:20', 1, NULL, false, '12', 5, '138', NULL),
(34, 20, 'Коробова ', 'Уточните, пожалуйста, ваш запрос. Что нужно сделать?', 1000, false, '3', 'new', 'Магнитогорск', '2025-09-07 13:55:11', '2025-10-16 14:51:00', 13, '2025-10-16 14:50:11', 1, '2025-10-16 14:50:36', true, '12', 100, '131', NULL),
(35, 20, 'Коробова ', 'щущк', 1000, false, '3', 'cancel', 'Магнитогорск', '2025-09-17 18:43:24', '2025-10-01 21:45:34', 2, '2025-10-01 21:45:24', 1, '2025-10-01 21:45:15', true, '12', 100, '131', NULL);

INSERT INTO house_category (id, name, deleted, created_at, updated_at) VALUES
(1, 'Квартиры', false, '2024-05-25 01:53:09', '2024-05-25 01:53:23'),
(2, 'Однокомнатная', false, '2025-05-04 03:41:45', '2025-05-04 03:41:45'),
(3, 'Многокомнатная', false, '2025-05-04 04:07:35', '2025-05-04 04:07:35'),
(4, 'Коттедж ', false, '2025-09-07 13:56:48', '2025-09-07 13:56:58');

INSERT INTO house_house_category (house_id, house_category_id) VALUES
(29, 2),
(30, 1),
(31, 1),
(32, 1),
(33, 1),
(34, 1),
(35, 1);

INSERT INTO house_house_service (house_id, service_id) VALUES
(29, 2),
(30, 2),
(31, 2),
(32, 2),
(33, 3),
(34, 2),
(35, 1);

INSERT INTO request (id, house_id, user_id, name, surname, lastname, count, message, phone, start_date, end_date, status, created_at, updated_at, confirmed_at, rejection_reason, guest_id, email) VALUES
(19, 31, NULL, 'Мерзачееко', 'Евгений ', 'Романович', 2, 'Желательно быстрее ответить ', '+7 (905) 368-81-18', '2025-08-30', '2025-08-31', 'cancelled', '2025-08-30 20:39:37', '2025-10-14 20:38:54', NULL, 'ТЯНА', 'cb25324b-2a71-43ca-8e4e-49805240d297', 'Valoskovaeliiveta@gmail.com'),
(20, 30, NULL, 'Артем', 'Кочетков', 'Евгеньевич', 2, '213', '+7 (982) 283-84-31', '2025-10-17', '2025-10-18', 'in_progress', '2025-10-17 00:34:12', '2025-10-17 00:34:12', NULL, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f', 'artuom2019@gmail.com'),
(21, 30, NULL, 'Артем', 'Кочетков', 'Евгеньевич', 2, '213', '+7 (982) 283-84-31', '2025-10-22', '2025-10-23', 'in_progress', '2025-10-17 00:36:52', '2025-10-17 00:36:52', NULL, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f', 'artuom2019@mail.ru'),
(22, 30, NULL, 'Артем', 'Кочетков', 'Евгеньевич', 2, '213', '+7 (982) 283-84-31', '2025-10-25', '2025-10-25', 'in_progress', '2025-10-17 00:37:50', '2025-10-17 00:37:50', NULL, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f', 'artuom2019@mail.ru');

INSERT INTO request_viewers (id, request_id, user_id, guest_id) VALUES
(40, 19, 2, NULL),
(41, 20, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f'),
(42, 21, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f'),
(43, 22, NULL, '253f62dc-e5b5-480a-9193-2dd024f06e3f'),
(44, 20, 2, NULL),
(45, 21, 2, NULL),
(46, 22, 2, NULL);

INSERT INTO service (id, name, deleted, created_at, updated_at) VALUES
(1, 'Холодильник', false, '2024-05-25 01:45:45', '2024-05-25 01:45:45'),
(2, 'Wi fi', false, '2024-06-30 21:02:29', '2024-06-30 21:02:29'),
(3, 'Посуда', false, '2024-06-30 21:02:36', '2024-06-30 21:02:36'),
(5, 'Гриль', false, '2025-04-12 18:23:42', '2025-04-12 18:23:42'),
(6, 'Микроволновая печь', false, '2025-04-12 18:23:42', '2025-04-12 18:23:42'),
(7, 'ТВ приставка', false, '2025-04-12 18:23:42', '2025-04-12 18:23:42'),
(8, 'Душевая кабина', false, '2025-04-12 18:23:42', '2025-04-12 18:23:42'),
(9, 'Посуда', false, '2025-04-12 18:23:42', '2025-04-12 18:23:42'),
(10, 'Play Station', true, '2025-05-04 03:42:11', '2025-05-04 03:42:18');

INSERT INTO "user" (id, name, surname, patronymic, email, password, roles, deleted, is_verified, google_id, phone, locale, city, enable, created_at, updated_at, code, date_code, rejection_reason) VALUES
(2, 'Adidasik', '147', NULL, 'artuom2021@gmail.com', '$2y$13$EdzkJQ4n52bdEnj9pjxvDOPuMz0W3mR/WicTVqxupvoIZ.k99qlMO', '[\"ROLE_ADMIN\"]', false, false, '100024804929215482852', NULL, NULL, 'Магнитогорск', true, '2024-05-21 20:27:05', '2025-10-17 00:32:03', '662007', '2025-10-17 00:32:00', NULL),
(3, 'Юлия', NULL, NULL, 'mlpokn1980@yandex.ru', '$2y$13$M52EkwBPXAJiB6sFIKC9WuqfjBXCz5JIvZ2dzK6elFQvi4DG.ddxO', '[\"ROLE_ADMIN\", \"ROLE_USER\"]', false, false, NULL, NULL, NULL, 'Магнитогорск', true, '2024-05-21 21:08:03', '2024-05-26 16:37:34', NULL, NULL, NULL),
(4, 'Анастасия ', NULL, NULL, 'anastasia9', '$2y$13$2uxVtfLc93j37NIGMlj3ROYoGP5mh0YnYKbcWDX2UYs/r1veBNqhK', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2024-05-21 22:59:25', '2024-05-21 22:59:25', NULL, NULL, NULL),
(5, 'Александр', NULL, NULL, 'ctb-lider@yandex.ru', '$2y$13$nHbGDGwGa.9a1F19eOzfqe0osDVqW6HxFYuhwZ.XmJMhGOa2sbFMi', '[\"ROLE_ADMIN\", \"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2024-05-22 10:34:59', '2025-08-08 18:14:06', NULL, NULL, NULL),
(6, 'Владимир', NULL, NULL, 'asdccjcn@yandex.ru', '$2y$13$6TNuk/ys1zut46c.pCFin.OGKZukVTysYX8Qp.XlfY8u5O/gi8mXm', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2024-05-27 10:31:50', '2024-05-27 10:31:50', NULL, NULL, NULL),
(7, 'Анастасия ', NULL, NULL, 'g-nasika2487@mail.ru', '$2y$13$24ZNlttjGcg4ztiG13aTJOtjKW7XjA/gsXi4XhcBpWOLw823oFrqy', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, 'Санкт-Петербург', true, '2024-06-05 00:45:10', '2024-06-05 00:45:16', NULL, NULL, NULL),
(8, 'Юлия', 'Панурко', 'Михайловна', 'panurko.yulia@mail.ru', '$2y$13$wIJNpH2wTDVJiVbEVwymNeBVm7D2GjzJ6ZW2iGsejKbGZP8rqLRy2', '[\"ROLE_ADMIN\", \"ROLE_USER\"]', false, false, NULL, '+7 (922) 722-97-03', NULL, 'Магнитогорск', true, '2024-06-10 06:15:58', '2025-09-09 09:11:07', NULL, NULL, NULL),
(9, 'sutkiTest', NULL, NULL, 'sutkiTest@gmail.com', '$2y$13$Y3NXgH.7OKYBW4HQx4DsaOb91Dj05MmtJ0fxTp5vqCMSEStw92B3m', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, 'Магнитогорск', true, '2024-06-11 17:50:47', '2024-06-11 17:50:51', NULL, NULL, NULL),
(12, 'Александр', NULL, NULL, '79512603671@yandex.ru', '$2y$13$dzjvdALVXvjoCww7bYh0LOjdWroumCWKBt4hxoWLrsgq3UaR4ktTC', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2024-06-26 15:24:22', '2024-06-26 15:24:22', NULL, NULL, NULL),
(13, 'Владислав', 'Шерстяных', 'Игоревич', 'vdcjeqjladmh@bk.ru', '$2y$13$fd0Cu9m4OaUG36.ujACGc.6zlVzH1XQgBVkOztMRw/5H7kB31.S6C', '[\"ROLE_USER\"]', false, false, NULL, '+7 (900) 299-82-71', NULL, NULL, true, '2024-07-02 17:11:17', '2024-07-02 17:44:25', NULL, NULL, NULL),
(20, 'Артем ', 'Кочетков', NULL, 'artuom2019@gmail.com', '$2y$13$t/vpawQUDrGyLZdMMUXhyuJmlKvwUMpgByBSKlNfh9dSKP6GQ1Tiq', '[\"ROLE_USER\"]', false, false, '117947775982133317577', '78982322505', NULL, NULL, true, '2024-07-13 00:11:24', '2025-08-05 20:27:39', NULL, NULL, NULL),
(21, 'Артём ', 'Кочетков', 'Евгеньевич ', 'artuom2019@mail.ru', '$2y$13$YoumzRrBTgpfHcyjk6pJqeEZUejgNgxVTvmWJHUZSm2ioY5IW1.Q2', '[\"ROLE_USER\"]', false, false, NULL, '+7 (982) 283-84-32', NULL, NULL, true, '2024-07-13 00:22:26', '2024-07-13 00:49:42', NULL, NULL, NULL),
(22, 'Юля', 'Петрова', NULL, 'yulswb@gmail.com', NULL, '[\"ROLE_USER\"]', false, false, '116484124654457798711', NULL, NULL, NULL, true, '2024-07-24 16:24:05', '2024-07-24 16:24:05', NULL, NULL, NULL),
(25, 'Кетчуп', 'Кетчуп', NULL, 'sane23222@gmail.com', '$2y$13$E3KL8h7seYgo.9myCK4jFeRQH62HvJ15ieIEYKRgD96IeTtLiPKSm', '[\"ROLE_USER\"]', false, false, '104960285566747349304', '78574836543', NULL, NULL, true, '2025-06-21 17:33:50', '2025-06-21 23:10:44', NULL, NULL, NULL),
(26, 'WeebWebWorks', NULL, NULL, 'weebwebworks@gmail.com', NULL, '[\"ROLE_USER\"]', false, false, '103985865782414268481', NULL, NULL, NULL, true, '2025-06-21 17:38:00', '2025-06-21 17:38:00', NULL, NULL, NULL),
(27, 'Александр', 'Темников', 'Павлович', 'alexandr.temnickov@yandex.ru', '$2y$13$WMhEFPpjFIWOy9KBNjpLMOFaYmr8ILMXhvfwsc2rNQj7JCCHQB1mS', '[\"ROLE_USER\"]', false, false, NULL, '75435454354', NULL, NULL, true, '2025-08-12 11:43:39', '2025-08-12 11:55:42', NULL, NULL, NULL),
(28, 'Юлия', NULL, NULL, 'p.panurko@ya.ru', '$2y$13$1xqluKZc/Wg6mPE9.CvN6eBBCSZzxzzDhltJ1/rcH3zjL75GTQEFu', '[\"ROLE_ADMIN\", \"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2025-09-09 08:56:27', '2025-09-09 09:10:42', NULL, NULL, NULL),
(29, 'Nam', 'Phu', NULL, 'phunam279@gmail.com', NULL, '[\"ROLE_USER\"]', false, false, '100769121303338494421', NULL, NULL, NULL, true, '2025-12-17 21:27:24', '2025-12-17 21:27:24', NULL, NULL, NULL),
(30, 'Дмитрий', NULL, NULL, 'elec-list@yandex.ru', '$2y$13$mdPiz5Im79urH5bprixUTuHvPFTPWZPzmIpchqIpwybOMGjO4bw8.', '[\"ROLE_USER\"]', false, false, NULL, NULL, NULL, NULL, true, '2026-01-07 12:09:20', '2026-01-07 12:09:20', NULL, NULL, NULL);

INSERT INTO views (id, value, view_date) VALUES
(379, 60, '2025-08-18 00:00:00'),
(380, 69, '2025-08-19 00:00:00'),
(381, 58, '2025-08-20 00:00:00'),
(382, 89, '2025-08-21 00:00:00'),
(383, 53, '2025-08-22 00:00:00'),
(384, 66, '2025-08-23 00:00:00'),
(385, 48, '2025-08-24 00:00:00'),
(386, 37, '2025-08-25 00:00:00'),
(387, 20, '2025-08-26 00:00:00'),
(388, 17, '2025-08-27 00:00:00'),
(389, 26, '2025-08-28 00:00:00'),
(390, 343, '2025-08-29 00:00:00'),
(391, 441, '2025-08-30 00:00:00'),
(392, 745, '2025-08-31 00:00:00'),
(393, 293, '2025-09-01 00:00:00'),
(394, 258, '2025-09-02 00:00:00'),
(395, 97, '2025-09-03 00:00:00'),
(396, 166, '2025-09-04 00:00:00'),
(397, 222, '2025-09-05 00:00:00'),
(398, 234, '2025-09-06 00:00:00'),
(399, 189, '2025-09-07 00:00:00'),
(400, 152, '2025-09-08 00:00:00'),
(401, 119, '2025-09-09 00:00:00'),
(402, 115, '2025-09-10 00:00:00'),
(403, 69, '2025-09-11 00:00:00'),
(404, 22, '2025-09-12 00:00:00'),
(405, 10, '2025-09-13 00:00:00'),
(406, 35, '2025-09-14 00:00:00'),
(407, 13, '2025-09-15 00:00:00'),
(408, 34, '2025-09-16 00:00:00'),
(409, 30, '2025-09-17 00:00:00'),
(410, 27, '2025-09-18 00:00:00'),
(411, 37, '2025-09-19 00:00:00'),
(412, 28, '2025-09-20 00:00:00'),
(413, 19, '2025-09-21 00:00:00'),
(414, 22, '2025-09-22 00:00:00'),
(415, 24, '2025-09-23 00:00:00'),
(416, 25, '2025-09-24 00:00:00'),
(417, 24, '2025-09-25 00:00:00'),
(418, 17, '2025-09-26 00:00:00'),
(419, 11, '2025-09-27 00:00:00'),
(420, 7, '2025-09-28 00:00:00'),
(421, 26, '2025-09-29 00:00:00'),
(422, 22, '2025-09-30 00:00:00'),
(423, 31, '2025-10-01 00:00:00'),
(424, 25, '2025-10-02 00:00:00'),
(425, 30, '2025-10-03 00:00:00'),
(426, 46, '2025-10-04 00:00:00'),
(427, 51, '2025-10-05 00:00:00'),
(428, 7, '2025-10-06 00:00:00'),
(429, 6, '2025-10-07 00:00:00'),
(430, 5, '2025-10-08 00:00:00'),
(431, 7, '2025-10-09 00:00:00'),
(432, 27, '2025-10-10 00:00:00'),
(433, 5, '2025-10-11 00:00:00'),
(434, 4, '2025-10-12 00:00:00'),
(435, 8, '2025-10-13 00:00:00'),
(436, 7, '2025-10-14 00:00:00'),
(437, 7, '2025-10-15 00:00:00'),
(438, 15, '2025-10-16 00:00:00'),
(439, 7, '2025-10-17 00:00:00'),
(440, 22, '2025-10-18 00:00:00'),
(441, 10, '2025-10-19 00:00:00'),
(442, 4, '2025-10-20 00:00:00'),
(443, 5, '2025-10-21 00:00:00'),
(444, 4, '2025-10-22 00:00:00'),
(445, 12, '2025-10-23 00:00:00'),
(446, 16, '2025-10-24 00:00:00'),
(447, 14, '2025-10-25 00:00:00'),
(448, 7, '2025-10-26 00:00:00'),
(449, 5, '2025-10-27 00:00:00'),
(450, 4, '2025-10-28 00:00:00'),
(451, 2, '2025-10-29 00:00:00'),
(452, 5, '2025-10-30 00:00:00'),
(453, 2, '2025-10-31 00:00:00'),
(454, 4, '2025-11-01 00:00:00'),
(455, 6, '2025-11-02 00:00:00'),
(456, 3, '2025-11-03 00:00:00'),
(457, 4, '2025-11-04 00:00:00'),
(458, 11, '2025-11-05 00:00:00'),
(459, 5, '2025-11-06 00:00:00'),
(460, 4, '2025-11-07 00:00:00'),
(461, 7, '2025-11-08 00:00:00'),
(462, 4, '2025-11-09 00:00:00'),
(463, 3, '2025-11-10 00:00:00'),
(464, 4, '2025-11-11 00:00:00'),
(465, 11, '2025-11-12 00:00:00'),
(466, 11, '2025-11-13 00:00:00'),
(467, 8, '2025-11-14 00:00:00'),
(468, 26, '2025-11-15 00:00:00'),
(469, 7, '2025-11-16 00:00:00'),
(470, 10, '2025-11-17 00:00:00'),
(471, 3, '2025-11-18 00:00:00'),
(472, 6, '2025-11-19 00:00:00'),
(473, 192, '2025-11-20 00:00:00'),
(474, 10, '2025-11-21 00:00:00'),
(475, 7, '2025-11-22 00:00:00'),
(476, 3, '2025-11-23 00:00:00'),
(477, 4, '2025-11-24 00:00:00'),
(478, 14, '2025-11-25 00:00:00'),
(479, 7, '2025-11-26 00:00:00'),
(480, 3, '2025-11-27 00:00:00'),
(481, 9, '2025-11-28 00:00:00'),
(482, 5, '2025-11-29 00:00:00'),
(483, 51, '2025-11-30 00:00:00'),
(484, 5, '2025-12-01 00:00:00'),
(485, 14, '2025-12-02 00:00:00'),
(486, 7, '2025-12-03 00:00:00'),
(487, 4, '2025-12-04 00:00:00'),
(488, 3, '2025-12-05 00:00:00'),
(489, 6, '2025-12-06 00:00:00'),
(490, 6, '2025-12-07 00:00:00'),
(491, 4, '2025-12-08 00:00:00'),
(492, 3, '2025-12-09 00:00:00'),
(493, 3, '2025-12-10 00:00:00'),
(494, 5, '2025-12-11 00:00:00'),
(495, 9, '2025-12-12 00:00:00'),
(496, 5, '2025-12-13 00:00:00'),
(497, 6, '2025-12-14 00:00:00'),
(498, 15, '2025-12-15 00:00:00'),
(499, 5, '2025-12-16 00:00:00'),
(500, 12, '2025-12-17 00:00:00'),
(501, 9, '2025-12-18 00:00:00'),
(502, 8, '2025-12-19 00:00:00'),
(503, 6, '2025-12-20 00:00:00'),
(504, 4, '2025-12-21 00:00:00'),
(505, 4, '2025-12-22 00:00:00'),
(506, 7, '2025-12-23 00:00:00'),
(507, 8, '2025-12-24 00:00:00'),
(508, 8, '2025-12-25 00:00:00'),
(509, 22, '2025-12-26 00:00:00'),
(510, 14, '2025-12-27 00:00:00'),
(511, 4, '2025-12-28 00:00:00'),
(512, 5, '2025-12-29 00:00:00'),
(513, 4, '2025-12-30 00:00:00'),
(514, 4, '2025-12-31 00:00:00'),
(515, 6, '2026-01-01 00:00:00'),
(516, 6, '2026-01-02 00:00:00'),
(517, 3, '2026-01-03 00:00:00'),
(518, 6, '2026-01-04 00:00:00'),
(519, 4, '2026-01-05 00:00:00'),
(520, 8, '2026-01-06 00:00:00'),
(521, 29, '2026-01-07 00:00:00'),
(522, 17, '2026-01-08 00:00:00'),
(523, 12, '2026-01-09 00:00:00'),
(524, 10, '2026-01-10 00:00:00'),
(525, 11, '2026-01-11 00:00:00'),
(526, 9, '2026-01-12 00:00:00'),
(527, 9, '2026-01-13 00:00:00'),
(528, 20, '2026-01-14 00:00:00'),
(529, 20, '2026-01-15 00:00:00'),
(530, 8, '2026-01-16 00:00:00'),
(531, 6, '2026-01-17 00:00:00'),
(532, 7, '2026-01-18 00:00:00'),
(533, 4, '2026-01-19 00:00:00'),
(534, 9, '2026-01-20 00:00:00'),
(535, 6, '2026-01-21 00:00:00'),
(536, 9, '2026-01-22 00:00:00'),
(537, 3, '2026-01-23 00:00:00'),
(538, 10, '2026-01-24 00:00:00'),
(539, 9, '2026-01-25 00:00:00'),
(540, 6, '2026-01-26 00:00:00'),
(541, 9, '2026-01-27 00:00:00'),
(542, 5, '2026-01-28 00:00:00'),
(543, 5, '2026-01-29 00:00:00'),
(544, 3, '2026-01-30 00:00:00'),
(545, 18, '2026-01-31 00:00:00'),
(546, 16, '2026-02-01 00:00:00'),
(547, 17, '2026-02-02 00:00:00'),
(548, 8, '2026-02-03 00:00:00'),
(549, 7, '2026-02-04 00:00:00'),
(550, 11, '2026-02-05 00:00:00'),
(551, 5, '2026-02-06 00:00:00'),
(552, 23, '2026-02-07 00:00:00'),
(553, 14, '2026-02-08 00:00:00'),
(554, 9, '2026-02-09 00:00:00'),
(555, 5, '2026-02-10 00:00:00'),
(556, 17, '2026-02-11 00:00:00'),
(557, 10, '2026-02-12 00:00:00'),
(558, 13, '2026-02-13 00:00:00'),
(559, 12, '2026-02-15 00:00:00'),
(560, 6, '2026-02-16 00:00:00'),
(561, 20, '2026-02-17 00:00:00'),
(562, 9, '2026-02-18 00:00:00'),
(563, 16, '2026-02-19 00:00:00'),
(564, 3, '2026-02-20 00:00:00'),
(565, 9, '2026-02-21 00:00:00'),
(566, 6, '2026-02-22 00:00:00'),
(567, 6, '2026-02-23 00:00:00'),
(568, 14, '2026-02-24 00:00:00'),
(569, 9, '2026-02-25 00:00:00'),
(570, 10, '2026-02-26 00:00:00'),
(571, 11, '2026-02-27 00:00:00'),
(572, 15, '2026-02-28 00:00:00'),
(573, 13, '2026-03-01 00:00:00'),
(574, 12, '2026-03-02 00:00:00'),
(575, 8, '2026-03-03 00:00:00'),
(576, 17, '2026-03-04 00:00:00'),
(577, 13, '2026-03-05 00:00:00'),
(578, 12, '2026-03-06 00:00:00'),
(579, 12, '2026-03-07 00:00:00'),
(580, 12, '2026-03-08 00:00:00'),
(581, 12, '2026-03-09 00:00:00'),
(582, 24, '2026-03-10 00:00:00'),
(583, 17, '2026-03-11 00:00:00'),
(584, 13, '2026-03-12 00:00:00'),
(585, 8, '2026-03-13 00:00:00'),
(586, 10, '2026-03-14 00:00:00'),
(587, 25, '2026-03-15 00:00:00'),
(588, 20, '2026-03-16 00:00:00'),
(589, 15, '2026-03-17 00:00:00'),
(590, 15, '2026-03-18 00:00:00'),
(591, 11, '2026-03-19 00:00:00'),
(592, 14, '2026-03-20 00:00:00'),
(593, 9, '2026-03-21 00:00:00'),
(594, 11, '2026-03-22 00:00:00'),
(595, 13, '2026-03-23 00:00:00'),
(596, 17, '2026-03-24 00:00:00'),
(597, 10, '2026-03-25 00:00:00'),
(598, 9, '2026-03-26 00:00:00'),
(599, 19, '2026-03-27 00:00:00'),
(600, 10, '2026-03-28 00:00:00'),
(601, 13, '2026-03-29 00:00:00'),
(602, 7, '2026-03-30 00:00:00'),
(603, 10, '2026-03-31 00:00:00'),
(604, 12, '2026-04-01 00:00:00'),
(605, 13, '2026-04-02 00:00:00'),
(606, 8, '2026-04-03 00:00:00'),
(607, 17, '2026-04-04 00:00:00'),
(608, 9, '2026-04-05 00:00:00'),
(609, 7, '2026-04-06 00:00:00'),
(610, 18, '2026-04-07 00:00:00'),
(611, 18, '2026-04-08 00:00:00'),
(612, 8, '2026-04-16 00:00:00'),
(613, 18, '2026-04-17 00:00:00'),
(614, 6, '2026-04-18 00:00:00'),
(615, 10, '2026-04-19 00:00:00'),
(616, 12, '2026-04-20 00:00:00'),
(617, 10, '2026-04-21 00:00:00'),
(618, 8, '2026-04-22 00:00:00'),
(619, 9, '2026-04-23 00:00:00'),
(620, 31, '2026-04-24 00:00:00'),
(621, 7, '2026-04-25 00:00:00'),
(622, 8, '2026-04-26 00:00:00'),
(623, 7, '2026-04-27 00:00:00'),
(624, 10, '2026-04-28 00:00:00'),
(625, 8, '2026-04-29 00:00:00'),
(626, 12, '2026-04-30 00:00:00'),
(627, 7, '2026-05-01 00:00:00'),
(628, 13, '2026-05-02 00:00:00'),
(629, 10, '2026-05-03 00:00:00'),
(630, 13, '2026-05-04 00:00:00'),
(631, 14, '2026-05-05 00:00:00'),
(632, 15, '2026-05-06 00:00:00'),
(633, 18, '2026-05-07 00:00:00'),
(634, 16, '2026-05-08 00:00:00'),
(635, 9, '2026-05-09 00:00:00'),
(636, 11, '2026-05-10 00:00:00'),
(637, 6, '2026-05-11 00:00:00'),
(638, 7, '2026-05-12 00:00:00'),
(639, 6, '2026-05-13 00:00:00'),
(640, 8, '2026-05-14 00:00:00'),
(641, 8, '2026-05-15 00:00:00'),
(642, 9, '2026-05-16 00:00:00'),
(643, 11, '2026-05-17 00:00:00'),
(644, 12, '2026-05-18 00:00:00'),
(645, 10, '2026-05-19 00:00:00'),
(646, 9, '2026-05-20 00:00:00'),
(647, 14, '2026-05-21 00:00:00'),
(648, 6, '2026-05-22 00:00:00'),
(649, 8, '2026-05-23 00:00:00'),
(650, 9, '2026-05-24 00:00:00'),
(651, 8, '2026-05-25 00:00:00'),
(652, 10, '2026-05-26 00:00:00'),
(653, 10, '2026-05-27 00:00:00'),
(654, 29, '2026-06-09 00:00:00'),
(655, 9, '2026-06-10 00:00:00'),
(656, 5, '2026-06-11 00:00:00');

-- Foreign key constraints
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC212469DE2 FOREIGN KEY (category_id) REFERENCES house_category (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2642B8210 FOREIGN KEY (admin_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2ED5CA9E6 FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE;
ALTER TABLE comment ADD CONSTRAINT FK_9474526C2261B4C3 FOREIGN KEY (addressee_id) REFERENCES "user" (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C6BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C727ACA70 FOREIGN KEY (parent_id) REFERENCES comment (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C7E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);
ALTER TABLE file ADD CONSTRAINT FK_8C9F36106BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE house ADD CONSTRAINT FK_67D5399D7E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);
ALTER TABLE house_house_category ADD CONSTRAINT FK_A2C97DEF6BB74515 FOREIGN KEY (house_id) REFERENCES house (id) ON DELETE CASCADE;
ALTER TABLE house_house_category ADD CONSTRAINT FK_A2C97DEF6C967117 FOREIGN KEY (house_category_id) REFERENCES house_category (id) ON DELETE CASCADE;
ALTER TABLE house_house_service ADD CONSTRAINT FK_B53DD9B46BB74515 FOREIGN KEY (house_id) REFERENCES house (id) ON DELETE CASCADE;
ALTER TABLE house_house_service ADD CONSTRAINT FK_B53DD9B4ED5CA9E6 FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE;
ALTER TABLE request ADD CONSTRAINT FK_3B978F9F6BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE request ADD CONSTRAINT FK_3B978F9FA76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id);
ALTER TABLE request_viewers ADD CONSTRAINT FK_2A28448B427EB8A5 FOREIGN KEY (request_id) REFERENCES request (id);
ALTER TABLE request_viewers ADD CONSTRAINT FK_2A28448BA76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id);
ALTER TABLE review ADD CONSTRAINT FK_794381C66BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE review ADD CONSTRAINT FK_794381C67E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);

-- Reset sequences for serial columns
SELECT setval(pg_get_serial_sequence('admin_story', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM admin_story;
SELECT setval(pg_get_serial_sequence('code', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM code;
SELECT setval(pg_get_serial_sequence('comment', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM comment;
SELECT setval(pg_get_serial_sequence('file', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM file;
SELECT setval(pg_get_serial_sequence('guest', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM guest;
SELECT setval(pg_get_serial_sequence('house', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM house;
SELECT setval(pg_get_serial_sequence('house_category', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM house_category;
SELECT setval(pg_get_serial_sequence('house_house_category', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM house_house_category;
SELECT setval(pg_get_serial_sequence('house_house_service', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM house_house_service;
SELECT setval(pg_get_serial_sequence('request', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM request;
SELECT setval(pg_get_serial_sequence('request_viewers', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM request_viewers;
SELECT setval(pg_get_serial_sequence('review', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM review;
SELECT setval(pg_get_serial_sequence('service', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM service;
SELECT setval(pg_get_serial_sequence('session_ip_address', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM session_ip_address;
SELECT setval(pg_get_serial_sequence('"user"', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM "user";
SELECT setval(pg_get_serial_sequence('views', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM views;