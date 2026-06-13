-- Baseline schema for the existing 'sutki' database (legacy web project, Symfony/Doctrine).
-- This reflects what already exists in production (Timeweb) / the converted dump.
-- All statements are idempotent (IF NOT EXISTS) so this is safe to run against an existing DB.
-- Mobile-specific additions live in db/migrations/. No production data is stored here.
-- NOTE: the original converted dump relies on MySQL-style escaping; load data with
--       'SET standard_conforming_strings = off;' if importing the legacy dump.

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
