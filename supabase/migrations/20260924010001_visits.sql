/* What visitors do in the album, and nothing about who they are.
 *
 * The site is static on GitHub Pages, which keeps no logs we can read, and
 * Supabase's own request logs are gone within a day and now behind an
 * analytics endpoint this project cannot query at all. So the album counts its
 * own visitors or it does not count them.
 *
 * What is NOT collected, deliberately: no IP address, not even hashed; no
 * cookie; no fingerprint; no page URL beyond the route the site itself defines;
 * no referrer beyond its host. The two identifiers are random strings the
 * browser makes up for itself — one per tab in sessionStorage, one per browser
 * in localStorage — and a visitor who clears their storage is a new visitor,
 * which is the honest answer.
 *
 * Geography comes from the browser's own time zone, which it hands over
 * without being asked and which no lookup service has to see. Asia/Jerusalem
 * resolves to Israel, Australia/Perth to Australia. The city in tmz_tz is the
 * zone's reference city, NOT where the visitor is: someone in Haifa reports
 * Asia/Jerusalem. The back office says so on the panel rather than pretending
 * otherwise.
 */

-- ---- the one piece of geography we keep ----------------------------------
-- Generated from the system IANA tables (zone1970.tab, zone.tab and the link
-- list in tzdata.zi) by scripts/zone-table.mjs, retired spellings included:
-- a browser still reporting Asia/Calcutta or US/Eastern resolves correctly.
create table if not exists tmz_tz (
  zone    text primary key,
  country text,               -- ISO 3166-1 alpha-2; null for UTC and the Etc/* names
  city    text not null        -- the zone's reference city, not the visitor's
);
comment on table tmz_tz is
  'IANA time zone to country and reference city. The city is the zone''s, not the visitor''s.';
insert into tmz_tz (zone, country, city) values
  ('Africa/Abidjan', 'CI', 'Abidjan'),
  ('Africa/Accra', 'GH', 'Accra'),
  ('Africa/Addis_Ababa', 'ET', 'Addis Ababa'),
  ('Africa/Algiers', 'DZ', 'Algiers'),
  ('Africa/Asmara', 'ER', 'Asmara'),
  ('Africa/Asmera', 'ER', 'Asmara'),
  ('Africa/Bamako', 'ML', 'Bamako'),
  ('Africa/Bangui', 'CF', 'Bangui'),
  ('Africa/Banjul', 'GM', 'Banjul'),
  ('Africa/Bissau', 'GW', 'Bissau'),
  ('Africa/Blantyre', 'MW', 'Blantyre'),
  ('Africa/Brazzaville', 'CG', 'Brazzaville'),
  ('Africa/Bujumbura', 'BI', 'Bujumbura'),
  ('Africa/Cairo', 'EG', 'Cairo'),
  ('Africa/Casablanca', 'MA', 'Casablanca'),
  ('Africa/Ceuta', 'ES', 'Ceuta'),
  ('Africa/Conakry', 'GN', 'Conakry'),
  ('Africa/Dakar', 'SN', 'Dakar'),
  ('Africa/Dar_es_Salaam', 'TZ', 'Dar es Salaam'),
  ('Africa/Djibouti', 'DJ', 'Djibouti'),
  ('Africa/Douala', 'CM', 'Douala'),
  ('Africa/El_Aaiun', 'EH', 'El Aaiun'),
  ('Africa/Freetown', 'SL', 'Freetown'),
  ('Africa/Gaborone', 'BW', 'Gaborone'),
  ('Africa/Harare', 'ZW', 'Harare'),
  ('Africa/Johannesburg', 'ZA', 'Johannesburg'),
  ('Africa/Juba', 'SS', 'Juba'),
  ('Africa/Kampala', 'UG', 'Kampala'),
  ('Africa/Khartoum', 'SD', 'Khartoum'),
  ('Africa/Kigali', 'RW', 'Kigali'),
  ('Africa/Kinshasa', 'CD', 'Kinshasa'),
  ('Africa/Lagos', 'NG', 'Lagos'),
  ('Africa/Libreville', 'GA', 'Libreville'),
  ('Africa/Lome', 'TG', 'Lome'),
  ('Africa/Luanda', 'AO', 'Luanda'),
  ('Africa/Lubumbashi', 'CD', 'Lubumbashi'),
  ('Africa/Lusaka', 'ZM', 'Lusaka'),
  ('Africa/Malabo', 'GQ', 'Malabo'),
  ('Africa/Maputo', 'MZ', 'Maputo'),
  ('Africa/Maseru', 'LS', 'Maseru'),
  ('Africa/Mbabane', 'SZ', 'Mbabane'),
  ('Africa/Mogadishu', 'SO', 'Mogadishu'),
  ('Africa/Monrovia', 'LR', 'Monrovia'),
  ('Africa/Nairobi', 'KE', 'Nairobi'),
  ('Africa/Ndjamena', 'TD', 'Ndjamena'),
  ('Africa/Niamey', 'NE', 'Niamey'),
  ('Africa/Nouakchott', 'MR', 'Nouakchott'),
  ('Africa/Ouagadougou', 'BF', 'Ouagadougou'),
  ('Africa/Porto-Novo', 'BJ', 'Porto-Novo'),
  ('Africa/Sao_Tome', 'ST', 'Sao Tome'),
  ('Africa/Timbuktu', 'ML', 'Bamako'),
  ('Africa/Tripoli', 'LY', 'Tripoli'),
  ('Africa/Tunis', 'TN', 'Tunis'),
  ('Africa/Windhoek', 'NA', 'Windhoek'),
  ('America/Adak', 'US', 'Adak'),
  ('America/Anchorage', 'US', 'Anchorage'),
  ('America/Anguilla', 'AI', 'Anguilla'),
  ('America/Antigua', 'AG', 'Antigua'),
  ('America/Araguaina', 'BR', 'Araguaina'),
  ('America/Argentina/Buenos_Aires', 'AR', 'Buenos Aires'),
  ('America/Argentina/Catamarca', 'AR', 'Catamarca'),
  ('America/Argentina/ComodRivadavia', 'AR', 'Catamarca'),
  ('America/Argentina/Cordoba', 'AR', 'Cordoba'),
  ('America/Argentina/Jujuy', 'AR', 'Jujuy'),
  ('America/Argentina/La_Rioja', 'AR', 'La Rioja'),
  ('America/Argentina/Mendoza', 'AR', 'Mendoza'),
  ('America/Argentina/Rio_Gallegos', 'AR', 'Rio Gallegos'),
  ('America/Argentina/Salta', 'AR', 'Salta'),
  ('America/Argentina/San_Juan', 'AR', 'San Juan'),
  ('America/Argentina/San_Luis', 'AR', 'San Luis'),
  ('America/Argentina/Tucuman', 'AR', 'Tucuman'),
  ('America/Argentina/Ushuaia', 'AR', 'Ushuaia'),
  ('America/Aruba', 'AW', 'Aruba'),
  ('America/Asuncion', 'PY', 'Asuncion'),
  ('America/Atikokan', 'CA', 'Atikokan'),
  ('America/Atka', 'US', 'Adak'),
  ('America/Bahia', 'BR', 'Bahia'),
  ('America/Bahia_Banderas', 'MX', 'Bahia Banderas'),
  ('America/Barbados', 'BB', 'Barbados'),
  ('America/Belem', 'BR', 'Belem'),
  ('America/Belize', 'BZ', 'Belize'),
  ('America/Blanc-Sablon', 'CA', 'Blanc-Sablon'),
  ('America/Boa_Vista', 'BR', 'Boa Vista'),
  ('America/Bogota', 'CO', 'Bogota'),
  ('America/Boise', 'US', 'Boise'),
  ('America/Buenos_Aires', 'AR', 'Buenos Aires'),
  ('America/Cambridge_Bay', 'CA', 'Cambridge Bay'),
  ('America/Campo_Grande', 'BR', 'Campo Grande'),
  ('America/Cancun', 'MX', 'Cancun'),
  ('America/Caracas', 'VE', 'Caracas'),
  ('America/Catamarca', 'AR', 'Catamarca'),
  ('America/Cayenne', 'GF', 'Cayenne'),
  ('America/Cayman', 'KY', 'Cayman'),
  ('America/Chicago', 'US', 'Chicago'),
  ('America/Chihuahua', 'MX', 'Chihuahua'),
  ('America/Ciudad_Juarez', 'MX', 'Ciudad Juarez'),
  ('America/Coral_Harbour', 'CA', 'Atikokan'),
  ('America/Cordoba', 'AR', 'Cordoba'),
  ('America/Costa_Rica', 'CR', 'Costa Rica'),
  ('America/Coyhaique', 'CL', 'Coyhaique'),
  ('America/Creston', 'CA', 'Creston'),
  ('America/Cuiaba', 'BR', 'Cuiaba'),
  ('America/Curacao', 'CW', 'Curacao'),
  ('America/Danmarkshavn', 'GL', 'Danmarkshavn'),
  ('America/Dawson', 'CA', 'Dawson'),
  ('America/Dawson_Creek', 'CA', 'Dawson Creek'),
  ('America/Denver', 'US', 'Denver'),
  ('America/Detroit', 'US', 'Detroit'),
  ('America/Dominica', 'DM', 'Dominica'),
  ('America/Edmonton', 'CA', 'Edmonton'),
  ('America/Eirunepe', 'BR', 'Eirunepe'),
  ('America/El_Salvador', 'SV', 'El Salvador'),
  ('America/Ensenada', 'MX', 'Tijuana'),
  ('America/Fort_Nelson', 'CA', 'Fort Nelson'),
  ('America/Fort_Wayne', 'US', 'Indianapolis'),
  ('America/Fortaleza', 'BR', 'Fortaleza'),
  ('America/Glace_Bay', 'CA', 'Glace Bay'),
  ('America/Godthab', 'GL', 'Nuuk'),
  ('America/Goose_Bay', 'CA', 'Goose Bay'),
  ('America/Grand_Turk', 'TC', 'Grand Turk'),
  ('America/Grenada', 'GD', 'Grenada'),
  ('America/Guadeloupe', 'GP', 'Guadeloupe'),
  ('America/Guatemala', 'GT', 'Guatemala'),
  ('America/Guayaquil', 'EC', 'Guayaquil'),
  ('America/Guyana', 'GY', 'Guyana'),
  ('America/Halifax', 'CA', 'Halifax'),
  ('America/Havana', 'CU', 'Havana'),
  ('America/Hermosillo', 'MX', 'Hermosillo'),
  ('America/Indiana/Indianapolis', 'US', 'Indianapolis'),
  ('America/Indiana/Knox', 'US', 'Knox'),
  ('America/Indiana/Marengo', 'US', 'Marengo'),
  ('America/Indiana/Petersburg', 'US', 'Petersburg'),
  ('America/Indiana/Tell_City', 'US', 'Tell City'),
  ('America/Indiana/Vevay', 'US', 'Vevay'),
  ('America/Indiana/Vincennes', 'US', 'Vincennes'),
  ('America/Indiana/Winamac', 'US', 'Winamac'),
  ('America/Indianapolis', 'US', 'Indianapolis'),
  ('America/Inuvik', 'CA', 'Inuvik'),
  ('America/Iqaluit', 'CA', 'Iqaluit'),
  ('America/Jamaica', 'JM', 'Jamaica'),
  ('America/Jujuy', 'AR', 'Jujuy'),
  ('America/Juneau', 'US', 'Juneau'),
  ('America/Kentucky/Louisville', 'US', 'Louisville'),
  ('America/Kentucky/Monticello', 'US', 'Monticello'),
  ('America/Knox_IN', 'US', 'Knox'),
  ('America/Kralendijk', 'BQ', 'Kralendijk'),
  ('America/La_Paz', 'BO', 'La Paz'),
  ('America/Lima', 'PE', 'Lima'),
  ('America/Los_Angeles', 'US', 'Los Angeles'),
  ('America/Louisville', 'US', 'Louisville'),
  ('America/Lower_Princes', 'SX', 'Lower Princes'),
  ('America/Maceio', 'BR', 'Maceio'),
  ('America/Managua', 'NI', 'Managua'),
  ('America/Manaus', 'BR', 'Manaus'),
  ('America/Marigot', 'MF', 'Marigot'),
  ('America/Martinique', 'MQ', 'Martinique'),
  ('America/Matamoros', 'MX', 'Matamoros'),
  ('America/Mazatlan', 'MX', 'Mazatlan'),
  ('America/Mendoza', 'AR', 'Mendoza'),
  ('America/Menominee', 'US', 'Menominee'),
  ('America/Merida', 'MX', 'Merida'),
  ('America/Metlakatla', 'US', 'Metlakatla'),
  ('America/Mexico_City', 'MX', 'Mexico City'),
  ('America/Miquelon', 'PM', 'Miquelon'),
  ('America/Moncton', 'CA', 'Moncton'),
  ('America/Monterrey', 'MX', 'Monterrey'),
  ('America/Montevideo', 'UY', 'Montevideo'),
  ('America/Montreal', 'CA', 'Toronto'),
  ('America/Montserrat', 'MS', 'Montserrat'),
  ('America/Nassau', 'BS', 'Nassau'),
  ('America/New_York', 'US', 'New York'),
  ('America/Nipigon', 'CA', 'Toronto'),
  ('America/Nome', 'US', 'Nome'),
  ('America/Noronha', 'BR', 'Noronha'),
  ('America/North_Dakota/Beulah', 'US', 'Beulah'),
  ('America/North_Dakota/Center', 'US', 'Center'),
  ('America/North_Dakota/New_Salem', 'US', 'New Salem'),
  ('America/Nuuk', 'GL', 'Nuuk'),
  ('America/Ojinaga', 'MX', 'Ojinaga'),
  ('America/Panama', 'PA', 'Panama'),
  ('America/Pangnirtung', 'CA', 'Iqaluit'),
  ('America/Paramaribo', 'SR', 'Paramaribo'),
  ('America/Phoenix', 'US', 'Phoenix'),
  ('America/Port_of_Spain', 'TT', 'Port of Spain'),
  ('America/Port-au-Prince', 'HT', 'Port-au-Prince'),
  ('America/Porto_Acre', 'BR', 'Rio Branco'),
  ('America/Porto_Velho', 'BR', 'Porto Velho'),
  ('America/Puerto_Rico', 'PR', 'Puerto Rico'),
  ('America/Punta_Arenas', 'CL', 'Punta Arenas'),
  ('America/Rainy_River', 'CA', 'Winnipeg'),
  ('America/Rankin_Inlet', 'CA', 'Rankin Inlet'),
  ('America/Recife', 'BR', 'Recife'),
  ('America/Regina', 'CA', 'Regina'),
  ('America/Resolute', 'CA', 'Resolute'),
  ('America/Rio_Branco', 'BR', 'Rio Branco'),
  ('America/Rosario', 'AR', 'Cordoba'),
  ('America/Santa_Isabel', 'MX', 'Tijuana'),
  ('America/Santarem', 'BR', 'Santarem'),
  ('America/Santiago', 'CL', 'Santiago'),
  ('America/Santo_Domingo', 'DO', 'Santo Domingo'),
  ('America/Sao_Paulo', 'BR', 'Sao Paulo'),
  ('America/Scoresbysund', 'GL', 'Scoresbysund'),
  ('America/Shiprock', 'US', 'Denver'),
  ('America/Sitka', 'US', 'Sitka'),
  ('America/St_Barthelemy', 'BL', 'St Barthelemy'),
  ('America/St_Johns', 'CA', 'St Johns'),
  ('America/St_Kitts', 'KN', 'St Kitts'),
  ('America/St_Lucia', 'LC', 'St Lucia'),
  ('America/St_Thomas', 'VI', 'St Thomas'),
  ('America/St_Vincent', 'VC', 'St Vincent'),
  ('America/Swift_Current', 'CA', 'Swift Current'),
  ('America/Tegucigalpa', 'HN', 'Tegucigalpa'),
  ('America/Thule', 'GL', 'Thule'),
  ('America/Thunder_Bay', 'CA', 'Toronto'),
  ('America/Tijuana', 'MX', 'Tijuana'),
  ('America/Toronto', 'CA', 'Toronto'),
  ('America/Tortola', 'VG', 'Tortola'),
  ('America/Vancouver', 'CA', 'Vancouver'),
  ('America/Virgin', 'VI', 'St Thomas'),
  ('America/Whitehorse', 'CA', 'Whitehorse'),
  ('America/Winnipeg', 'CA', 'Winnipeg'),
  ('America/Yakutat', 'US', 'Yakutat'),
  ('America/Yellowknife', 'CA', 'Edmonton'),
  ('Antarctica/Casey', 'AQ', 'Casey'),
  ('Antarctica/Davis', 'AQ', 'Davis'),
  ('Antarctica/DumontDUrville', 'AQ', 'DumontDUrville'),
  ('Antarctica/Macquarie', 'AU', 'Macquarie'),
  ('Antarctica/Mawson', 'AQ', 'Mawson'),
  ('Antarctica/McMurdo', 'AQ', 'McMurdo'),
  ('Antarctica/Palmer', 'AQ', 'Palmer'),
  ('Antarctica/Rothera', 'AQ', 'Rothera'),
  ('Antarctica/South_Pole', 'AQ', 'McMurdo'),
  ('Antarctica/Syowa', 'AQ', 'Syowa'),
  ('Antarctica/Troll', 'AQ', 'Troll'),
  ('Antarctica/Vostok', 'AQ', 'Vostok'),
  ('Arctic/Longyearbyen', 'SJ', 'Longyearbyen'),
  ('Asia/Aden', 'YE', 'Aden'),
  ('Asia/Almaty', 'KZ', 'Almaty'),
  ('Asia/Amman', 'JO', 'Amman'),
  ('Asia/Anadyr', 'RU', 'Anadyr'),
  ('Asia/Aqtau', 'KZ', 'Aqtau'),
  ('Asia/Aqtobe', 'KZ', 'Aqtobe'),
  ('Asia/Ashgabat', 'TM', 'Ashgabat'),
  ('Asia/Ashkhabad', 'TM', 'Ashgabat'),
  ('Asia/Atyrau', 'KZ', 'Atyrau'),
  ('Asia/Baghdad', 'IQ', 'Baghdad'),
  ('Asia/Bahrain', 'BH', 'Bahrain'),
  ('Asia/Baku', 'AZ', 'Baku'),
  ('Asia/Bangkok', 'TH', 'Bangkok'),
  ('Asia/Barnaul', 'RU', 'Barnaul'),
  ('Asia/Beirut', 'LB', 'Beirut'),
  ('Asia/Bishkek', 'KG', 'Bishkek'),
  ('Asia/Brunei', 'BN', 'Brunei'),
  ('Asia/Calcutta', 'IN', 'Kolkata'),
  ('Asia/Chita', 'RU', 'Chita'),
  ('Asia/Choibalsan', 'MN', 'Ulaanbaatar'),
  ('Asia/Chongqing', 'CN', 'Shanghai'),
  ('Asia/Chungking', 'CN', 'Shanghai'),
  ('Asia/Colombo', 'LK', 'Colombo'),
  ('Asia/Dacca', 'BD', 'Dhaka'),
  ('Asia/Damascus', 'SY', 'Damascus'),
  ('Asia/Dhaka', 'BD', 'Dhaka'),
  ('Asia/Dili', 'TL', 'Dili'),
  ('Asia/Dubai', 'AE', 'Dubai'),
  ('Asia/Dushanbe', 'TJ', 'Dushanbe'),
  ('Asia/Famagusta', 'CY', 'Famagusta'),
  ('Asia/Gaza', 'PS', 'Gaza'),
  ('Asia/Harbin', 'CN', 'Shanghai'),
  ('Asia/Hebron', 'PS', 'Hebron'),
  ('Asia/Ho_Chi_Minh', 'VN', 'Ho Chi Minh'),
  ('Asia/Hong_Kong', 'HK', 'Hong Kong'),
  ('Asia/Hovd', 'MN', 'Hovd'),
  ('Asia/Irkutsk', 'RU', 'Irkutsk'),
  ('Asia/Istanbul', 'TR', 'Istanbul'),
  ('Asia/Jakarta', 'ID', 'Jakarta'),
  ('Asia/Jayapura', 'ID', 'Jayapura'),
  ('Asia/Jerusalem', 'IL', 'Jerusalem'),
  ('Asia/Kabul', 'AF', 'Kabul'),
  ('Asia/Kamchatka', 'RU', 'Kamchatka'),
  ('Asia/Karachi', 'PK', 'Karachi'),
  ('Asia/Kashgar', 'CN', 'Urumqi'),
  ('Asia/Kathmandu', 'NP', 'Kathmandu'),
  ('Asia/Katmandu', 'NP', 'Kathmandu'),
  ('Asia/Khandyga', 'RU', 'Khandyga'),
  ('Asia/Kolkata', 'IN', 'Kolkata'),
  ('Asia/Krasnoyarsk', 'RU', 'Krasnoyarsk'),
  ('Asia/Kuala_Lumpur', 'MY', 'Kuala Lumpur'),
  ('Asia/Kuching', 'MY', 'Kuching'),
  ('Asia/Kuwait', 'KW', 'Kuwait'),
  ('Asia/Macao', 'MO', 'Macau'),
  ('Asia/Macau', 'MO', 'Macau'),
  ('Asia/Magadan', 'RU', 'Magadan'),
  ('Asia/Makassar', 'ID', 'Makassar'),
  ('Asia/Manila', 'PH', 'Manila'),
  ('Asia/Muscat', 'OM', 'Muscat'),
  ('Asia/Nicosia', 'CY', 'Nicosia'),
  ('Asia/Novokuznetsk', 'RU', 'Novokuznetsk'),
  ('Asia/Novosibirsk', 'RU', 'Novosibirsk'),
  ('Asia/Omsk', 'RU', 'Omsk'),
  ('Asia/Oral', 'KZ', 'Oral'),
  ('Asia/Phnom_Penh', 'KH', 'Phnom Penh'),
  ('Asia/Pontianak', 'ID', 'Pontianak'),
  ('Asia/Pyongyang', 'KP', 'Pyongyang'),
  ('Asia/Qatar', 'QA', 'Qatar'),
  ('Asia/Qostanay', 'KZ', 'Qostanay'),
  ('Asia/Qyzylorda', 'KZ', 'Qyzylorda'),
  ('Asia/Rangoon', 'MM', 'Yangon'),
  ('Asia/Riyadh', 'SA', 'Riyadh'),
  ('Asia/Saigon', 'VN', 'Ho Chi Minh'),
  ('Asia/Sakhalin', 'RU', 'Sakhalin'),
  ('Asia/Samarkand', 'UZ', 'Samarkand'),
  ('Asia/Seoul', 'KR', 'Seoul'),
  ('Asia/Shanghai', 'CN', 'Shanghai'),
  ('Asia/Singapore', 'SG', 'Singapore'),
  ('Asia/Srednekolymsk', 'RU', 'Srednekolymsk'),
  ('Asia/Taipei', 'TW', 'Taipei'),
  ('Asia/Tashkent', 'UZ', 'Tashkent'),
  ('Asia/Tbilisi', 'GE', 'Tbilisi'),
  ('Asia/Tehran', 'IR', 'Tehran'),
  ('Asia/Tel_Aviv', 'IL', 'Jerusalem'),
  ('Asia/Thimbu', 'BT', 'Thimphu'),
  ('Asia/Thimphu', 'BT', 'Thimphu'),
  ('Asia/Tokyo', 'JP', 'Tokyo'),
  ('Asia/Tomsk', 'RU', 'Tomsk'),
  ('Asia/Ujung_Pandang', 'ID', 'Makassar'),
  ('Asia/Ulaanbaatar', 'MN', 'Ulaanbaatar'),
  ('Asia/Ulan_Bator', 'MN', 'Ulaanbaatar'),
  ('Asia/Urumqi', 'CN', 'Urumqi'),
  ('Asia/Ust-Nera', 'RU', 'Ust-Nera'),
  ('Asia/Vientiane', 'LA', 'Vientiane'),
  ('Asia/Vladivostok', 'RU', 'Vladivostok'),
  ('Asia/Yakutsk', 'RU', 'Yakutsk'),
  ('Asia/Yangon', 'MM', 'Yangon'),
  ('Asia/Yekaterinburg', 'RU', 'Yekaterinburg'),
  ('Asia/Yerevan', 'AM', 'Yerevan'),
  ('Atlantic/Azores', 'PT', 'Azores'),
  ('Atlantic/Bermuda', 'BM', 'Bermuda'),
  ('Atlantic/Canary', 'ES', 'Canary'),
  ('Atlantic/Cape_Verde', 'CV', 'Cape Verde'),
  ('Atlantic/Faeroe', 'FO', 'Faroe'),
  ('Atlantic/Faroe', 'FO', 'Faroe'),
  ('Atlantic/Jan_Mayen', 'NO', 'Oslo'),
  ('Atlantic/Madeira', 'PT', 'Madeira'),
  ('Atlantic/Reykjavik', 'IS', 'Reykjavik'),
  ('Atlantic/South_Georgia', 'GS', 'South Georgia'),
  ('Atlantic/St_Helena', 'SH', 'St Helena'),
  ('Atlantic/Stanley', 'FK', 'Stanley'),
  ('Australia/ACT', 'AU', 'Sydney'),
  ('Australia/Adelaide', 'AU', 'Adelaide'),
  ('Australia/Brisbane', 'AU', 'Brisbane'),
  ('Australia/Broken_Hill', 'AU', 'Broken Hill'),
  ('Australia/Canberra', 'AU', 'Sydney'),
  ('Australia/Currie', 'AU', 'Hobart'),
  ('Australia/Darwin', 'AU', 'Darwin'),
  ('Australia/Eucla', 'AU', 'Eucla'),
  ('Australia/Hobart', 'AU', 'Hobart'),
  ('Australia/LHI', 'AU', 'Lord Howe'),
  ('Australia/Lindeman', 'AU', 'Lindeman'),
  ('Australia/Lord_Howe', 'AU', 'Lord Howe'),
  ('Australia/Melbourne', 'AU', 'Melbourne'),
  ('Australia/North', 'AU', 'Darwin'),
  ('Australia/NSW', 'AU', 'Sydney'),
  ('Australia/Perth', 'AU', 'Perth'),
  ('Australia/Queensland', 'AU', 'Brisbane'),
  ('Australia/South', 'AU', 'Adelaide'),
  ('Australia/Sydney', 'AU', 'Sydney'),
  ('Australia/Tasmania', 'AU', 'Hobart'),
  ('Australia/Victoria', 'AU', 'Melbourne'),
  ('Australia/West', 'AU', 'Perth'),
  ('Australia/Yancowinna', 'AU', 'Broken Hill'),
  ('Brazil/Acre', 'BR', 'Rio Branco'),
  ('Brazil/DeNoronha', 'BR', 'Noronha'),
  ('Brazil/East', 'BR', 'Sao Paulo'),
  ('Brazil/West', 'BR', 'Manaus'),
  ('Canada/Atlantic', 'CA', 'Halifax'),
  ('Canada/Central', 'CA', 'Winnipeg'),
  ('Canada/Eastern', 'CA', 'Toronto'),
  ('Canada/Mountain', 'CA', 'Edmonton'),
  ('Canada/Newfoundland', 'CA', 'St Johns'),
  ('Canada/Pacific', 'CA', 'Vancouver'),
  ('Canada/Saskatchewan', 'CA', 'Regina'),
  ('Canada/Yukon', 'CA', 'Whitehorse'),
  ('Chile/Continental', 'CL', 'Santiago'),
  ('Chile/EasterIsland', 'CL', 'Easter'),
  ('Cuba', 'CU', 'Havana'),
  ('Egypt', 'EG', 'Cairo'),
  ('Eire', 'IE', 'Dublin'),
  ('Etc/GMT', null, 'UTC'),
  ('Etc/Greenwich', null, 'UTC'),
  ('Etc/UTC', null, 'UTC'),
  ('Europe/Amsterdam', 'NL', 'Amsterdam'),
  ('Europe/Andorra', 'AD', 'Andorra'),
  ('Europe/Astrakhan', 'RU', 'Astrakhan'),
  ('Europe/Athens', 'GR', 'Athens'),
  ('Europe/Belfast', 'GB', 'London'),
  ('Europe/Belgrade', 'RS', 'Belgrade'),
  ('Europe/Berlin', 'DE', 'Berlin'),
  ('Europe/Bratislava', 'SK', 'Bratislava'),
  ('Europe/Brussels', 'BE', 'Brussels'),
  ('Europe/Bucharest', 'RO', 'Bucharest'),
  ('Europe/Budapest', 'HU', 'Budapest'),
  ('Europe/Busingen', 'DE', 'Busingen'),
  ('Europe/Chisinau', 'MD', 'Chisinau'),
  ('Europe/Copenhagen', 'DK', 'Copenhagen'),
  ('Europe/Dublin', 'IE', 'Dublin'),
  ('Europe/Gibraltar', 'GI', 'Gibraltar'),
  ('Europe/Guernsey', 'GG', 'Guernsey'),
  ('Europe/Helsinki', 'FI', 'Helsinki'),
  ('Europe/Isle_of_Man', 'IM', 'Isle of Man'),
  ('Europe/Istanbul', 'TR', 'Istanbul'),
  ('Europe/Jersey', 'JE', 'Jersey'),
  ('Europe/Kaliningrad', 'RU', 'Kaliningrad'),
  ('Europe/Kiev', 'UA', 'Kyiv'),
  ('Europe/Kirov', 'RU', 'Kirov'),
  ('Europe/Kyiv', 'UA', 'Kyiv'),
  ('Europe/Lisbon', 'PT', 'Lisbon'),
  ('Europe/Ljubljana', 'SI', 'Ljubljana'),
  ('Europe/London', 'GB', 'London'),
  ('Europe/Luxembourg', 'LU', 'Luxembourg'),
  ('Europe/Madrid', 'ES', 'Madrid'),
  ('Europe/Malta', 'MT', 'Malta'),
  ('Europe/Mariehamn', 'AX', 'Mariehamn'),
  ('Europe/Minsk', 'BY', 'Minsk'),
  ('Europe/Monaco', 'MC', 'Monaco'),
  ('Europe/Moscow', 'RU', 'Moscow'),
  ('Europe/Nicosia', 'CY', 'Nicosia'),
  ('Europe/Oslo', 'NO', 'Oslo'),
  ('Europe/Paris', 'FR', 'Paris'),
  ('Europe/Podgorica', 'ME', 'Podgorica'),
  ('Europe/Prague', 'CZ', 'Prague'),
  ('Europe/Riga', 'LV', 'Riga'),
  ('Europe/Rome', 'IT', 'Rome'),
  ('Europe/Samara', 'RU', 'Samara'),
  ('Europe/San_Marino', 'SM', 'San Marino'),
  ('Europe/Sarajevo', 'BA', 'Sarajevo'),
  ('Europe/Saratov', 'RU', 'Saratov'),
  ('Europe/Simferopol', 'RU', 'Simferopol'),
  ('Europe/Skopje', 'MK', 'Skopje'),
  ('Europe/Sofia', 'BG', 'Sofia'),
  ('Europe/Stockholm', 'SE', 'Stockholm'),
  ('Europe/Tallinn', 'EE', 'Tallinn'),
  ('Europe/Tirane', 'AL', 'Tirane'),
  ('Europe/Tiraspol', 'MD', 'Chisinau'),
  ('Europe/Ulyanovsk', 'RU', 'Ulyanovsk'),
  ('Europe/Uzhgorod', 'UA', 'Kyiv'),
  ('Europe/Vaduz', 'LI', 'Vaduz'),
  ('Europe/Vatican', 'VA', 'Vatican'),
  ('Europe/Vienna', 'AT', 'Vienna'),
  ('Europe/Vilnius', 'LT', 'Vilnius'),
  ('Europe/Volgograd', 'RU', 'Volgograd'),
  ('Europe/Warsaw', 'PL', 'Warsaw'),
  ('Europe/Zagreb', 'HR', 'Zagreb'),
  ('Europe/Zaporozhye', 'UA', 'Kyiv'),
  ('Europe/Zurich', 'CH', 'Zurich'),
  ('GB', 'GB', 'London'),
  ('GB-Eire', 'GB', 'London'),
  ('GMT', null, 'UTC'),
  ('Hongkong', 'HK', 'Hong Kong'),
  ('Iceland', 'IS', 'Reykjavik'),
  ('Indian/Antananarivo', 'MG', 'Antananarivo'),
  ('Indian/Chagos', 'IO', 'Chagos'),
  ('Indian/Christmas', 'CX', 'Christmas'),
  ('Indian/Cocos', 'CC', 'Cocos'),
  ('Indian/Comoro', 'KM', 'Comoro'),
  ('Indian/Kerguelen', 'TF', 'Kerguelen'),
  ('Indian/Mahe', 'SC', 'Mahe'),
  ('Indian/Maldives', 'MV', 'Maldives'),
  ('Indian/Mauritius', 'MU', 'Mauritius'),
  ('Indian/Mayotte', 'YT', 'Mayotte'),
  ('Indian/Reunion', 'RE', 'Reunion'),
  ('Iran', 'IR', 'Tehran'),
  ('Israel', 'IL', 'Jerusalem'),
  ('Jamaica', 'JM', 'Jamaica'),
  ('Japan', 'JP', 'Tokyo'),
  ('Kwajalein', 'MH', 'Kwajalein'),
  ('Libya', 'LY', 'Tripoli'),
  ('Mexico/BajaNorte', 'MX', 'Tijuana'),
  ('Mexico/BajaSur', 'MX', 'Mazatlan'),
  ('Mexico/General', 'MX', 'Mexico City'),
  ('Navajo', 'US', 'Denver'),
  ('NZ', 'NZ', 'Auckland'),
  ('NZ-CHAT', 'NZ', 'Chatham'),
  ('Pacific/Apia', 'WS', 'Apia'),
  ('Pacific/Auckland', 'NZ', 'Auckland'),
  ('Pacific/Bougainville', 'PG', 'Bougainville'),
  ('Pacific/Chatham', 'NZ', 'Chatham'),
  ('Pacific/Chuuk', 'FM', 'Chuuk'),
  ('Pacific/Easter', 'CL', 'Easter'),
  ('Pacific/Efate', 'VU', 'Efate'),
  ('Pacific/Enderbury', 'KI', 'Kanton'),
  ('Pacific/Fakaofo', 'TK', 'Fakaofo'),
  ('Pacific/Fiji', 'FJ', 'Fiji'),
  ('Pacific/Funafuti', 'TV', 'Funafuti'),
  ('Pacific/Galapagos', 'EC', 'Galapagos'),
  ('Pacific/Gambier', 'PF', 'Gambier'),
  ('Pacific/Guadalcanal', 'SB', 'Guadalcanal'),
  ('Pacific/Guam', 'GU', 'Guam'),
  ('Pacific/Honolulu', 'US', 'Honolulu'),
  ('Pacific/Johnston', 'US', 'Honolulu'),
  ('Pacific/Kanton', 'KI', 'Kanton'),
  ('Pacific/Kiritimati', 'KI', 'Kiritimati'),
  ('Pacific/Kosrae', 'FM', 'Kosrae'),
  ('Pacific/Kwajalein', 'MH', 'Kwajalein'),
  ('Pacific/Majuro', 'MH', 'Majuro'),
  ('Pacific/Marquesas', 'PF', 'Marquesas'),
  ('Pacific/Midway', 'UM', 'Midway'),
  ('Pacific/Nauru', 'NR', 'Nauru'),
  ('Pacific/Niue', 'NU', 'Niue'),
  ('Pacific/Norfolk', 'NF', 'Norfolk'),
  ('Pacific/Noumea', 'NC', 'Noumea'),
  ('Pacific/Pago_Pago', 'AS', 'Pago Pago'),
  ('Pacific/Palau', 'PW', 'Palau'),
  ('Pacific/Pitcairn', 'PN', 'Pitcairn'),
  ('Pacific/Pohnpei', 'FM', 'Pohnpei'),
  ('Pacific/Ponape', 'FM', 'Pohnpei'),
  ('Pacific/Port_Moresby', 'PG', 'Port Moresby'),
  ('Pacific/Rarotonga', 'CK', 'Rarotonga'),
  ('Pacific/Saipan', 'MP', 'Saipan'),
  ('Pacific/Samoa', 'AS', 'Pago Pago'),
  ('Pacific/Tahiti', 'PF', 'Tahiti'),
  ('Pacific/Tarawa', 'KI', 'Tarawa'),
  ('Pacific/Tongatapu', 'TO', 'Tongatapu'),
  ('Pacific/Truk', 'FM', 'Chuuk'),
  ('Pacific/Wake', 'UM', 'Wake'),
  ('Pacific/Wallis', 'WF', 'Wallis'),
  ('Pacific/Yap', 'FM', 'Chuuk'),
  ('Poland', 'PL', 'Warsaw'),
  ('Portugal', 'PT', 'Lisbon'),
  ('PRC', 'CN', 'Shanghai'),
  ('ROC', 'TW', 'Taipei'),
  ('ROK', 'KR', 'Seoul'),
  ('Singapore', 'SG', 'Singapore'),
  ('Turkey', 'TR', 'Istanbul'),
  ('US/Alaska', 'US', 'Anchorage'),
  ('US/Aleutian', 'US', 'Adak'),
  ('US/Arizona', 'US', 'Phoenix'),
  ('US/Central', 'US', 'Chicago'),
  ('US/East-Indiana', 'US', 'Indianapolis'),
  ('US/Eastern', 'US', 'New York'),
  ('US/Hawaii', 'US', 'Honolulu'),
  ('US/Indiana-Starke', 'US', 'Knox'),
  ('US/Michigan', 'US', 'Detroit'),
  ('US/Mountain', 'US', 'Denver'),
  ('US/Pacific', 'US', 'Los Angeles'),
  ('US/Samoa', 'AS', 'Pago Pago'),
  ('UTC', null, 'UTC'),
  ('W-SU', 'RU', 'Moscow')on conflict (zone) do update set country = excluded.country, city = excluded.city;

alter table tmz_tz enable row level security;
revoke all on table tmz_tz from anon, authenticated;

-- ---- the log --------------------------------------------------------------
create table if not exists tmz_visit (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  sess      text not null,       -- one tab, from sessionStorage
  who       text not null,       -- one browser, from localStorage
  kind      text not null check (kind in ('view', 'photo', 'click', 'leave')),
  route     text,                -- map | community | year | contribute | about | ...
  community text,                -- community slug, where the route has one
  yr        smallint,            -- year page
  photo     uuid,                -- the photograph opened full screen
  label     text,                -- what was clicked
  lang      text,
  tz        text,                -- IANA zone, the only geography taken
  device    text,                -- phone | tablet | desktop
  ref       text,                -- referring host only, never the path
  secs      integer,             -- on 'leave': engaged seconds on that route
  bot       boolean not null default false   -- navigator.webdriver: our own tests
);
create index if not exists tmz_visit_at_idx    on tmz_visit (at desc);
create index if not exists tmz_visit_sess_idx  on tmz_visit (sess);
create index if not exists tmz_visit_who_idx   on tmz_visit (who, at);
create index if not exists tmz_visit_kind_idx  on tmz_visit (kind, at desc);

comment on table tmz_visit is
  'One row per thing a visitor did. No IP, no cookie, no fingerprint. Readable only through tmz_visits().';

alter table tmz_visit enable row level security;
revoke all on table tmz_visit from anon, authenticated;
-- No policy, on purpose: nothing reads this table directly. The browser writes
-- through tmz_visit_log() and the back office reads through tmz_visits(), both
-- security definer, so a stolen anon key cannot enumerate the log.

-- ---- writing --------------------------------------------------------------
/* The site posts a small batch every few seconds and one last batch by
   sendBeacon on the way out. Every field is clamped and every cast is guarded,
   because the caller is a browser holding a public key: a malformed year must
   not raise, and a long label must not become a way to store data here. */
create or replace function tmz_visit_log(batch jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  first_sess text;
  n integer := 0;
begin
  if jsonb_typeof(batch) <> 'array' or jsonb_array_length(batch) = 0 then return 0; end if;

  first_sess := left(batch->0->>'s', 24);
  if coalesce(first_sess, '') = '' then return 0; end if;

  /* A ceiling per tab per day. One visitor cannot run the row count up, and a
     real session never comes close — the busiest honest afternoon on this site
     is a few hundred events. */
  if (select count(*) from tmz_visit
      where sess = first_sess and at > now() - interval '1 day') > 600 then
    return 0;
  end if;

  insert into tmz_visit (sess, who, kind, route, community, yr, photo, label, lang, tz, device, ref, secs, bot)
  select
    left(e->>'s', 24),
    left(e->>'w', 24),
    e->>'k',
    nullif(left(e->>'r', 24), ''),
    nullif(left(e->>'c', 64), ''),
    case when e->>'y' ~ '^[0-9]{4}$' then (e->>'y')::smallint end,
    case when e->>'p' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then (e->>'p')::uuid end,
    nullif(left(e->>'l', 80), ''),
    nullif(left(e->>'g', 8), ''),
    nullif(left(e->>'z', 64), ''),
    case when e->>'d' in ('phone', 'tablet', 'desktop') then e->>'d' end,
    nullif(left(e->>'f', 64), ''),
    case when e->>'t' ~ '^[0-9]{1,5}$' then least((e->>'t')::integer, 7200) end,
    coalesce(nullif(e->>'b', '') = 'true', false)
  from jsonb_array_elements(batch) with ordinality as a(e, ord)
  where ord <= 40
    and e->>'k' in ('view', 'photo', 'click', 'leave')
    and coalesce(e->>'s', '') <> ''
    and coalesce(e->>'w', '') <> '';

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function tmz_visit_log(jsonb) from public;
grant execute on function tmz_visit_log(jsonb) to anon, authenticated;

-- ---- reading --------------------------------------------------------------
/* Everything the back office's Visits tab draws, in one call. Buckets are cut
   in the reader's own time zone, so "yesterday" means their yesterday rather
   than UTC's — the organisation is three hours ahead of the server and a day
   boundary in the wrong zone moves every evening's traffic into the next day. */
create or replace function tmz_visits(days integer default 30, zone text default 'UTC')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d     integer := least(greatest(coalesce(days, 30), 1), 400);
  z     text    := coalesce((select name from pg_timezone_names where name = zone), 'UTC');
  since timestamptz;
  out   jsonb;
begin
  if not tmz_is_staff() then
    raise exception 'tmz_visits is for staff' using errcode = '42501';
  end if;

  since := (date_trunc('day', now() at time zone z) - make_interval(days => d - 1)) at time zone z;

  with v as (
    select * from tmz_visit where at >= since and not bot
  ),
  s as (                                  -- one row per tab
    select sess,
           min(who)   as who,
           min(at)    as began,
           count(*) filter (where kind = 'view')  as views,
           count(*) filter (where kind = 'photo') as photos,
           count(*) filter (where kind = 'click') as clicks,
           coalesce(sum(secs) filter (where kind = 'leave'), 0) as secs,
           /* what the visit arrived with, not what sorts first: a reader who
              switches language mid-visit came in on one of them, and min()
              would answer "de" because d precedes h. */
           (array_agg(lang   order by at) filter (where lang   is not null))[1] as lang,
           (array_agg(tz     order by at) filter (where tz     is not null))[1] as tz,
           (array_agg(device order by at) filter (where device is not null))[1] as device,
           (array_agg(ref    order by at) filter (where ref    is not null))[1] as ref
    from v group by sess
  ),
  known as (                             -- visitors we had already met
    select count(distinct b.who) as n
    from tmz_visit b
    where not b.bot and b.at < since
      and b.who in (select who from s)
  ),
  geo as (
    select s.sess, t.country as cc, coalesce(t.city, s.tz) as city
    from s left join tmz_tz t on t.zone = s.tz
  ),
  ax as (                                 -- every day in the window, zeros included
    select generate_series(
             date_trunc('day', now() at time zone z) - make_interval(days => d - 1),
             date_trunc('day', now() at time zone z),
             interval '1 day')::date as day
  )
  select jsonb_build_object(
    'days', d,
    'zone', z,
    'since', since,

    'totals', (select jsonb_build_object(
        'visitors',    count(distinct who),
        'sessions',    count(*),
        'views',       coalesce(sum(views), 0),
        'photos',      coalesce(sum(photos), 0),
        'clicks',      coalesce(sum(clicks), 0),
        'bounced',     count(*) filter (where views <= 1),
        'returning',   (select n from known),
        'median_secs', (select round(percentile_cont(0.5) within group (order by secs)) from s where secs > 0),
        'mean_secs',   (select round(avg(secs)) from s where secs > 0),
        'live',        (select count(distinct sess) from tmz_visit
                        where at > now() - interval '30 minutes' and not bot)
      ) from s),

    'by_day', (select coalesce(jsonb_agg(jsonb_build_object(
          'd', ax.day,
          'sessions', (select count(*) from s where (s.began at time zone z)::date = ax.day),
          'views',    (select count(*) from v where v.kind = 'view' and (v.at at time zone z)::date = ax.day)
        ) order by ax.day), '[]'::jsonb) from ax),

    'heat', (select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'h', hr, 'n', n)), '[]'::jsonb)
      from (select extract(isodow from v.at at time zone z)::int as dow,
                   extract(hour   from v.at at time zone z)::int as hr,
                   count(*) as n
            from v where kind = 'view' group by 1, 2) q),

    'countries', (select coalesce(jsonb_agg(jsonb_build_object('cc', cc, 'n', n) order by n desc), '[]'::jsonb)
      from (select cc, count(*) n from geo where cc is not null group by 1 order by n desc limit 40) q),

    'cities', (select coalesce(jsonb_agg(jsonb_build_object('city', city, 'cc', cc, 'n', n) order by n desc), '[]'::jsonb)
      from (select city, min(cc) cc, count(*) n from geo where city is not null group by city order by n desc limit 30) q),

    'devices', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(device, 'unknown') k, count(*) n from s group by 1) q),

    'langs', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(lang, 'unknown') k, count(*) n from s group by 1) q),

    'routes', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'views', views, 'sessions', sessions, 'secs', secs) order by views desc), '[]'::jsonb)
      from (select route k,
                   count(*) filter (where kind = 'view') views,
                   count(distinct sess) filter (where kind = 'view') sessions,
                   round(percentile_cont(0.5) within group (order by nullif(secs, 0))) secs
            from v where route is not null group by 1 order by views desc limit 30) q),

    'communities', (select coalesce(jsonb_agg(jsonb_build_object('slug', q.k, 'name', coalesce(tr.name, q.k), 'n', q.n) order by q.n desc), '[]'::jsonb)
      from (select community k, count(*) n from v
            where kind = 'view' and community is not null group by 1 order by n desc limit 30) q
      left join tmz_community c on c.slug = q.k
      left join tmz_community_tr tr on tr.community_id = c.id and tr.lang = 'en'),

    'years', (select coalesce(jsonb_agg(jsonb_build_object('yr', yr, 'n', n) order by yr), '[]'::jsonb)
      from (select yr, count(*) n from v where kind = 'view' and yr is not null group by 1) q),

    'photos', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', q.photo, 'n', q.n, 'path', p.public_path, 'slug', c.slug, 'yr', p.year) order by q.n desc), '[]'::jsonb)
      from (select photo, count(*) n from v
            where kind = 'photo' and photo is not null group by 1 order by n desc limit 24) q
      left join tmz_photo p on p.id = q.photo
      left join tmz_community c on c.id = p.community_id),

    'refs', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(ref, '(direct)') k, count(*) n from s group by 1 order by n desc limit 20) q),

    'clicks', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select label k, count(*) n from v
            where kind = 'click' and label is not null group by 1 order by n desc limit 25) q),

    'depth', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by ord), '[]'::jsonb)
      from (select case when views <= 1 then '1'
                        when views = 2 then '2'
                        when views between 3 and 4 then '3-4'
                        when views between 5 and 9 then '5-9'
                        else '10+' end as k,
                   case when views <= 1 then 1 when views = 2 then 2
                        when views between 3 and 4 then 3
                        when views between 5 and 9 then 4 else 5 end as ord,
                   count(*) n
            from s group by 1, 2) q)
  ) into out;

  return out;
end $$;

/* Supabase's default privileges grant EXECUTE on any new function to anon,
   authenticated and service_role. That grant is to those roles by name, so
   "revoke from public" leaves it in place: anon has to be named to be removed.
   The staff check inside would refuse anon anyway, but a reading function the
   public can reach is one accident away from mattering. */
revoke all on function tmz_visits(integer, text) from public, anon;
grant execute on function tmz_visits(integer, text) to authenticated;

-- ---- retention ------------------------------------------------------------
/* Rows are ~120 bytes and the free tier gives 500 MB of database. Fourteen
   months keeps a full year plus the comparison, and at this site's traffic that
   is a few tens of megabytes; the purge is what stops it becoming the largest
   table in the archive by the second year. */
create or replace function tmz_visit_purge() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from tmz_visit where at < now() - interval '425 days';
  get diagnostics n = row_count;
  return n;
end $$;

/* Nobody calls this but cron. Left at Supabase's defaults it is a security
   definer function that deletes rows and that anon may execute. */
revoke all on function tmz_visit_purge() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('tmz-visit-purge');
exception when others then null;
end $$;

select cron.schedule('tmz-visit-purge', '17 4 * * *', $$ select public.tmz_visit_purge(); $$);
