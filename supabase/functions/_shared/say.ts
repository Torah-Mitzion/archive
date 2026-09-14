/* Everything the agent says, in six languages.
 *
 * The agent's job is not to take photographs — it is to get people to send
 * them, and to learn enough about each one that it can go on the site with a
 * name, a year and a story. So it asks. One question at a time, the most
 * important first, and it stops the moment it has what it needs.
 *
 * Every refusal names its reason. A photograph is never turned away with
 * "did not pass our check": the sender hears what was wrong and what would
 * work instead, because there is nobody else for them to ask.
 */

export type Lang = 'en' | 'he' | 'ru' | 'fr' | 'de' | 'es';
export type Ask = 'community' | 'year' | 'people' | 'occasion';

type Strings = {
  welcome: string;          // first ever message from this number
  hello: string;            // a greeting later on
  nophoto: string;          // text arrived, nothing waiting, not a greeting
  got: string;              // a photograph arrived and passed
  ask: Record<Ask, string>; // the four questions
  noted: string;            // an answer landed, more to ask
  complete: string;         // everything known; published or recorded
  completeHeld: string;     // everything known; not on the site yet (AUTO_PUBLISH off / unsettled)
  more: string;             // nudge after completion
  dupe: string;
  unclear: string;          // an answer that answered nothing
  refuse: {                 // each names its reason
    nopeople: string; notphoto: string; sexual: string; violence: string;
    advert: string; screenshot: string; document: string; unclear: string;
    toobig: string; badfile: string; generic: string;
  };
  fetchfail: string;        // OUR failure, not theirs — never a strike
  paused: string;           // they are blocked; said once rather than silence
  slowdown: string;         // rate limited; said rather than silence
  missed: string;           // the watchdog found an unanswered message
  reminder: string;         // a day later, a photograph still lacks a place or a year
  seeIt: string;            // "{url}" — it is on the site, here
  portraitHint: string;     // how to send a picture of yourself
  pitch1: string;           // please share the bot and the site
  pitch2: string;           // "{site}" "{wa}" — the forwardable message itself
  pitch3: string;           // pass it on; and send more
  portraitLinked: string;   // "{name}" — their picture is now on their entries
  portraitWhich: string;    // "{list}" — several people by that name
  portraitNone: string;     // the name is not in the register
  blocked: string;
};

const S: Record<Lang, Strings> = {
  en: {
    welcome: 'Hello, and welcome. 📷\n\nThirty years of Torah MiTzion, one photograph at a time: shlichim, families, communities, celebrations — from every kollel and every year since 1996. We are putting the album together, and the pictures you kept are the ones still missing from it.\n\nJust send a photograph here. I will ask a couple of quick questions so it lands in the right year with the right names. Old, blurry, scanned — all welcome.\n\nWere you a shaliach or shlicha? Send a picture of yourself with the words “this is me” and your name, and it will appear next to your name.',
    hello: 'Hello again! Send a photograph whenever you like — I can take several in a row.',
    nophoto: 'Send a photograph whenever you are ready. Old prints, scans, phone photos — anything from a Torah MiTzion community.',
    got: 'Got it, thank you! 🙏',
    ask: {
      community: 'Which community is this from? (Memphis, Cape Town, Moscow…)',
      year: 'And roughly which year?',
      people: 'Who is in the photograph? First names are fine — as many as you remember.',
      occasion: 'What was the occasion? A shabbaton, a class, a farewell, just a regular day…'
    },
    noted: 'Noted. ',
    complete: 'Wonderful — that is everything. It is on the site now! 🎉',
    completeHeld: 'Wonderful — that is everything. It is safely in and will take its place in the album shortly.',
    more: '\n\nHave more from that year, or from another one? Send them whenever you like.',
    dupe: 'We already have that one — thank you all the same! Have another?',
    unclear: 'I did not quite catch that. ',
    refuse: {
      nopeople: 'Thank you for sending it. This album is about the people — the communities, the shlichim, the families — so we can only take photographs with people in them. Anything with faces is very welcome.',
      notphoto: 'That looks like a graphic or a drawing rather than a photograph, so I cannot add it. A photo of the real thing — even a scan of an old print — would be perfect.',
      sexual: 'I cannot add that one — it looks like it shows nudity or something intimate, and the album is open to everyone.',
      violence: 'I cannot add that one — it looks like it shows injury or violence, and the album is open to everyone.',
      advert: 'That looks like an advertisement or a flyer, and the album holds only photographs of people. A photo from the event itself would be perfect.',
      screenshot: 'That looks like a screenshot or a meme rather than a photograph, so I cannot add it. The original photo would be perfect.',
      document: 'That looks like a document with personal details in it, so I cannot put it on a public site. A photograph of people would be welcome.',
      unclear: 'I could not make that one out clearly enough to be sure it is safe to publish. Could you send a sharper copy, or the original?',
      toobig: 'That one is a little too large for me. Please send it as a normal photo rather than as a file or document, and it will go straight in.',
      badfile: 'I could not read that file as a photograph. JPEG, PNG or WebP work — try sending it as a normal photo.',
      generic: 'I cannot add that one, sorry.'
    },
    fetchfail: 'Sorry — I could not download that one. It is a glitch on my side, not yours. Could you send it again?',
    paused: 'I have had to pause this conversation for a day after several photographs I could not accept. You are welcome back tomorrow.',
    slowdown: 'You have sent a lot in a short time — thank you! Give me a few minutes to catch up, then carry on.',
    missed: 'Sorry — it looks like I missed your last message. That was my fault. Could you send it again? If it was a photograph, just send it once more.',
    reminder: 'Your photograph from yesterday is still waiting on one detail before it can go up. ',
    seeIt: 'You can see it on the site here:\n{url}',
    portraitHint: 'Were you a shaliach or shlicha? Send a picture of yourself with the words “this is me” and your name, and it will appear next to your name.',
    pitch1: 'To fill the album of every one of these thirty years, we would love you to share this with shlichim, community members and partners along the way.',
    pitch2: '📷 Thirty years of Torah MiTzion in photographs — every kollel, every year since 1996.\nFind your year: {site}\nSend the pictures you kept, straight from WhatsApp: {wa}',
    pitch3: 'We would be glad if you passed that message on 🙏 — and if you have more photographs, send them here.',
    portraitLinked: 'Lovely — that will be your picture on the site, next to {name}. ',
    portraitWhich: 'I found more than one person by that name: {list}. Which community were you in, so I know which is you?',
    portraitNone: 'I could not find that name in the register. How is it written in Hebrew or in English?',
    blocked: ''
  },
  he: {
    welcome: 'שלום, וברוכים הבאים. 📷\n\nשלושים שנות תורה מציון, תמונה אחת בכל פעם: שליחים, משפחות, קהילות, שמחות — מכל כולל ומכל שנה מאז 1996. אנחנו מרכיבים את האלבום, והתמונות ששמרתם הן אלה שעדיין חסרות בו.\n\nפשוט שלחו לכאן תמונה. אשאל כמה שאלות קצרות כדי שתגיע לשנה הנכונה עם השמות הנכונים. ישנה, מטושטשת, סרוקה — הכול מתקבל בברכה.\n\nהייתם שליחים או שליחות? שלחו תמונה של עצמכם עם המילים ״זו תמונה שלי״ והשם שלכם, והיא תופיע ליד השם שלכם.',
    hello: 'שלום שוב! שלחו תמונה מתי שתרצו — אפשר כמה ברצף.',
    nophoto: 'שלחו תמונה כשנוח לכם. תדפיסים ישנים, סריקות, צילומי טלפון — כל דבר מקהילה של תורה מציון.',
    got: 'קיבלתי, תודה! 🙏',
    ask: {
      community: 'מאיזו קהילה התמונה? (ממפיס, קייפטאון, מוסקבה…)',
      year: 'ובאיזו שנה בערך?',
      people: 'מי בתמונה? שמות פרטיים מספיקים — כמה שאתם זוכרים.',
      occasion: 'מה היה האירוע? שבתון, שיעור, מסיבת פרידה, סתם יום רגיל…'
    },
    noted: 'נרשם. ',
    complete: 'מצוין — זה הכול. התמונה באתר! 🎉',
    completeHeld: 'מצוין — זה הכול. היא אצלנו ותתפוס את מקומה באלבום בקרוב.',
    more: '\n\nיש עוד מאותה שנה, או משנה אחרת? שלחו מתי שתרצו.',
    dupe: 'את זו כבר יש לנו — תודה בכל זאת! יש עוד אחת?',
    unclear: 'לא הבנתי בדיוק. ',
    refuse: {
      nopeople: 'תודה ששלחתם. האלבום הזה הוא על האנשים — הקהילות, השליחים, המשפחות — אז אנחנו יכולים לקבל רק תמונות שיש בהן אנשים. כל דבר עם פנים מתקבל בשמחה.',
      notphoto: 'זה נראה כמו גרפיקה או איור ולא כמו תמונה, אז אי אפשר להוסיף. צילום של הדבר האמיתי — אפילו סריקה של תדפיס ישן — יהיה מושלם.',
      sexual: 'את זו אי אפשר להוסיף — נראה שיש בה עירום או משהו אינטימי, והאלבום פתוח לכולם.',
      violence: 'את זו אי אפשר להוסיף — נראה שיש בה פציעה או אלימות, והאלבום פתוח לכולם.',
      advert: 'זה נראה כמו פרסומת או פלייר, והאלבום מכיל רק תמונות של אנשים. תמונה מהאירוע עצמו תהיה מושלמת.',
      screenshot: 'זה נראה כמו צילום מסך או מם ולא כמו תמונה, אז אי אפשר להוסיף. התמונה המקורית תהיה מושלמת.',
      document: 'זה נראה כמו מסמך עם פרטים אישיים, אז אי אפשר להעלות לאתר ציבורי. תמונה של אנשים תתקבל בשמחה.',
      unclear: 'לא הצלחתי לראות את זו מספיק ברור כדי להיות בטוח שאפשר לפרסם. אפשר לשלוח עותק חד יותר, או את המקור?',
      toobig: 'זו קצת גדולה מדי בשבילי. שלחו אותה כתמונה רגילה ולא כקובץ או מסמך, והיא תיכנס מיד.',
      badfile: 'לא הצלחתי לקרוא את הקובץ כתמונה. JPEG, PNG או WebP עובדים — נסו לשלוח כתמונה רגילה.',
      generic: 'את זו אי אפשר להוסיף, מצטערים.'
    },
    fetchfail: 'מצטערים — לא הצלחתי להוריד את זו. תקלה אצלי, לא אצלכם. אפשר לשלוח שוב?',
    paused: 'נאלצתי להשהות את השיחה הזו ליום אחרי כמה תמונות שלא יכולתי לקבל. מחר נשמח לראותכם שוב.',
    slowdown: 'שלחתם הרבה בזמן קצר — תודה! תנו לי כמה דקות להדביק את הפער, ואז המשיכו.',
    missed: 'מצטערים — נראה שפספסתי את ההודעה האחרונה שלכם. זו טעות שלי. אפשר לשלוח שוב? אם זו הייתה תמונה, פשוט שלחו אותה עוד פעם.',
    reminder: 'התמונה ששלחתם אתמול עדיין מחכה לפרט אחד לפני שתעלה. ',
    seeIt: 'אפשר לראות אותה באתר כאן:\n{url}',
    portraitHint: 'הייתם שליחים או שליחות? שלחו תמונה של עצמכם עם המילים ״זו תמונה שלי״ והשם שלכם, והיא תופיע ליד השם שלכם.',
    pitch1: 'כדי למלא את האלבום של כל אחת משלושים השנים האלה, נשמח שתשתפו את זה עם שליחים, חברי קהילות ושותפים לדרך.',
    pitch2: '📷 שלושים שנות תורה מציון בתמונות — כל כולל, כל שנה מאז 1996.\nמצאו את השנה שלכם: {site}\nשלחו את התמונות ששמרתם, ישר מהוואטסאפ: {wa}',
    pitch3: 'נשמח אם תעבירו את ההודעה הזו הלאה 🙏 — ואם יש לכם עוד תמונות, שלחו אותן לכאן.',
    portraitLinked: 'יופי — זו תהיה התמונה שלכם באתר, ליד {name}. ',
    portraitWhich: 'מצאתי יותר מאדם אחד בשם הזה: {list}. באיזו קהילה הייתם, כדי שאדע מי מהם אתם?',
    portraitNone: 'לא מצאתי את השם הזה ברישומים. איך הוא נכתב בעברית או באנגלית?',
    blocked: ''
  },
  ru: {
    welcome: 'Здравствуйте, и добро пожаловать. 📷\n\nТридцать лет Тора ми-Цион, по одной фотографии: шлихим, семьи, общины, праздники — из каждого колеля и каждого года с 1996-го. Мы собираем альбом, и снимки, которые вы сохранили, — как раз те, которых в нём пока не хватает.\n\nПросто пришлите фотографию сюда. Я задам пару коротких вопросов, чтобы она попала в свой год с правильными именами. Старые, нечёткие, отсканированные — всё подходит.\n\nВы были шалиахом или шлихой? Пришлите свою фотографию со словами «это я» и своим именем — она появится рядом с вашим именем.',
    hello: 'Снова здравствуйте! Присылайте фотографию, когда захотите — можно несколько подряд.',
    nophoto: 'Присылайте фотографию, когда будет удобно. Старые снимки, сканы, фото с телефона — всё из общин «Тора МиЦион».',
    got: 'Получил, спасибо! 🙏',
    ask: {
      community: 'Из какой это общины? (Мемфис, Кейптаун, Москва…)',
      year: 'И примерно какого года?',
      people: 'Кто на фотографии? Достаточно имён — сколько помните.',
      occasion: 'Что это было за событие? Шаббатон, урок, прощание, обычный день…'
    },
    noted: 'Записал. ',
    complete: 'Отлично — это всё. Фотография уже на сайте! 🎉',
    completeHeld: 'Отлично — это всё. Она у нас и скоро займёт своё место в альбоме.',
    more: '\n\nЕсть ещё с того года или с другого? Присылайте, когда захотите.',
    dupe: 'Эта у нас уже есть — всё равно спасибо! Есть ещё?',
    unclear: 'Не совсем понял. ',
    refuse: {
      nopeople: 'Спасибо, что прислали. Этот альбом — о людях: общинах, шлихим, семьях, — поэтому мы берём только фотографии с людьми. Любой снимок с лицами очень ждём.',
      notphoto: 'Это похоже на графику или рисунок, а не на фотографию, поэтому добавить не могу. Фото настоящего — даже скан старого снимка — будет то что нужно.',
      sexual: 'Эту добавить не могу — похоже, на ней обнажённость или что-то интимное, а альбом открыт для всех.',
      violence: 'Эту добавить не могу — похоже, на ней травма или насилие, а альбом открыт для всех.',
      advert: 'Это похоже на рекламу или флаер, а в альбоме только фотографии людей. Фото с самого события было бы отлично.',
      screenshot: 'Это похоже на скриншот или мем, а не на фотографию, поэтому добавить не могу. Оригинальное фото подойдёт.',
      document: 'Это похоже на документ с личными данными, поэтому на публичный сайт его нельзя. Фотографию людей — с радостью.',
      unclear: 'Не смог разглядеть достаточно чётко, чтобы быть уверенным, что можно публиковать. Пришлёте копию почётче или оригинал?',
      toobig: 'Эта немного великовата. Пришлите как обычное фото, а не как файл или документ, и она сразу войдёт.',
      badfile: 'Не смог прочитать файл как фотографию. Подходят JPEG, PNG или WebP — попробуйте отправить как обычное фото.',
      generic: 'Эту добавить не могу, извините.'
    },
    fetchfail: 'Извините — не смог скачать эту. Сбой у меня, не у вас. Пришлёте ещё раз?',
    paused: 'Мне пришлось приостановить этот разговор на день после нескольких фотографий, которые я не смог принять. Завтра будем рады снова.',
    slowdown: 'Вы прислали много за короткое время — спасибо! Дайте мне несколько минут догнать, и продолжайте.',
    missed: 'Извините — похоже, я пропустил ваше последнее сообщение. Это моя вина. Пришлёте ещё раз? Если это была фотография, просто отправьте её снова.',
    reminder: 'Ваша вчерашняя фотография всё ещё ждёт одной детали, прежде чем попасть на сайт. ',
    seeIt: 'Её можно увидеть на сайте здесь:\n{url}',
    portraitHint: 'Вы были шалиахом или шлихой? Пришлите свою фотографию со словами «это я» и своим именем — она появится рядом с вашим именем.',
    pitch1: 'Чтобы альбом каждого из этих тридцати лет наполнился, мы будем рады, если вы поделитесь этим со шлихим, членами общин и друзьями.',
    pitch2: '📷 Тридцать лет Тора ми-Цион в фотографиях — каждый колель, каждый год с 1996-го.\nНайдите свой год: {site}\nПришлите сохранённые снимки прямо из WhatsApp: {wa}',
    pitch3: 'Будем рады, если вы перешлёте это сообщение 🙏 — а если у вас есть ещё фотографии, присылайте их сюда.',
    portraitLinked: 'Отлично — это будет ваше фото на сайте, рядом с именем {name}. ',
    portraitWhich: 'Нашёл несколько человек с таким именем: {list}. В какой общине вы были, чтобы я понял, кто из них вы?',
    portraitNone: 'Не нашёл такого имени в реестре. Как оно пишется на иврите или по-английски?',
    blocked: ''
  },
  fr: {
    welcome: 'Bonjour, et bienvenue. 📷\n\nTrente ans de Torah MiTzion, une photographie à la fois : chlihim, familles, communautés, fêtes — de chaque kollel et de chaque année depuis 1996. Nous composons l’album, et les photos que vous avez gardées sont celles qui y manquent encore.\n\nEnvoyez simplement une photographie ici. Je vous poserai deux ou trois questions rapides pour qu’elle trouve sa bonne année et ses bons noms. Ancienne, floue, scannée — tout est bienvenu.\n\nVous avez été chaliah ou chliha ? Envoyez une photo de vous avec les mots « c’est moi » et votre nom, et elle apparaîtra à côté de votre nom.',
    hello: 'Rebonjour ! Envoyez une photographie quand vous voulez — j’en prends plusieurs à la suite.',
    nophoto: 'Envoyez une photographie quand vous êtes prêt. Tirages anciens, scans, photos de téléphone — tout ce qui vient d’une communauté Torah MiTzion.',
    got: 'Bien reçu, merci ! 🙏',
    ask: {
      community: 'De quelle communauté vient-elle ? (Memphis, Le Cap, Moscou…)',
      year: 'Et de quelle année, à peu près ?',
      people: 'Qui est sur la photographie ? Les prénoms suffisent — autant que vous vous en souvenez.',
      occasion: 'Quelle était l’occasion ? Un shabbaton, un cours, un départ, un jour ordinaire…'
    },
    noted: 'Noté. ',
    complete: 'Formidable — c’est tout. Elle est en ligne ! 🎉',
    completeHeld: 'Formidable — c’est tout. Elle est bien reçue et prendra bientôt sa place dans l’album.',
    more: '\n\nVous en avez d’autres de cette année-là, ou d’une autre ? Envoyez-les quand vous voulez.',
    dupe: 'Celle-ci, nous l’avons déjà — merci quand même ! Une autre ?',
    unclear: 'Je n’ai pas bien compris. ',
    refuse: {
      nopeople: 'Merci de l’avoir envoyée. Cet album parle des gens — communautés, chlihim, familles — donc nous ne prenons que des photographies avec des personnes. Tout cliché avec des visages est le bienvenu.',
      notphoto: 'Cela ressemble à un graphisme ou un dessin plutôt qu’à une photographie, je ne peux donc pas l’ajouter. Une photo de la vraie chose — même un scan d’un vieux tirage — serait parfaite.',
      sexual: 'Je ne peux pas ajouter celle-ci — elle semble montrer de la nudité ou quelque chose d’intime, et l’album est ouvert à tous.',
      violence: 'Je ne peux pas ajouter celle-ci — elle semble montrer une blessure ou de la violence, et l’album est ouvert à tous.',
      advert: 'Cela ressemble à une publicité ou un prospectus, et l’album ne contient que des photographies de personnes. Une photo de l’événement lui-même serait idéale.',
      screenshot: 'Cela ressemble à une capture d’écran ou un mème plutôt qu’à une photographie, je ne peux donc pas l’ajouter. La photo d’origine serait parfaite.',
      document: 'Cela ressemble à un document avec des informations personnelles, je ne peux donc pas le mettre sur un site public. Une photographie de personnes serait la bienvenue.',
      unclear: 'Je n’ai pas pu la distinguer assez nettement pour être sûr qu’elle peut être publiée. Pourriez-vous envoyer une copie plus nette, ou l’original ?',
      toobig: 'Celle-ci est un peu trop lourde pour moi. Envoyez-la comme photo normale plutôt que comme fichier, et elle sera ajoutée aussitôt.',
      badfile: 'Je n’ai pas pu lire ce fichier comme photographie. JPEG, PNG ou WebP fonctionnent — essayez de l’envoyer comme photo normale.',
      generic: 'Je ne peux pas ajouter celle-ci, désolé.'
    },
    fetchfail: 'Désolé — je n’ai pas pu télécharger celle-ci. C’est un souci de mon côté, pas du vôtre. Pourriez-vous la renvoyer ?',
    paused: 'J’ai dû mettre cette conversation en pause pour une journée après plusieurs photographies que je n’ai pas pu accepter. Vous êtes le bienvenu demain.',
    slowdown: 'Vous en avez envoyé beaucoup en peu de temps — merci ! Laissez-moi quelques minutes pour rattraper, puis continuez.',
    missed: 'Désolé — il semble que j’aie manqué votre dernier message. C’est ma faute. Pourriez-vous le renvoyer ? Si c’était une photographie, renvoyez-la simplement.',
    reminder: 'Votre photographie d’hier attend encore un détail avant de pouvoir être publiée. ',
    seeIt: 'Vous pouvez la voir sur le site ici :\n{url}',
    portraitHint: 'Vous avez été chaliah ou chliha ? Envoyez une photo de vous avec les mots « c’est moi » et votre nom, et elle apparaîtra à côté de votre nom.',
    pitch1: 'Pour remplir l’album de chacune de ces trente années, nous serions heureux que vous partagiez ceci avec des chlihim, des membres de communautés et des compagnons de route.',
    pitch2: '📷 Trente ans de Torah MiTzion en photographies — chaque kollel, chaque année depuis 1996.\nTrouvez votre année : {site}\nEnvoyez les photos que vous avez gardées, directement depuis WhatsApp : {wa}',
    pitch3: 'Nous serions heureux que vous transmettiez ce message 🙏 — et si vous avez d’autres photographies, envoyez-les ici.',
    portraitLinked: 'Parfait — ce sera votre photo sur le site, à côté de {name}. ',
    portraitWhich: 'J’ai trouvé plusieurs personnes de ce nom : {list}. Dans quelle communauté étiez-vous, pour que je sache laquelle est vous ?',
    portraitNone: 'Je n’ai pas trouvé ce nom dans le registre. Comment s’écrit-il en hébreu ou en anglais ?',
    blocked: ''
  },
  de: {
    welcome: 'Hallo und willkommen. 📷\n\nDreißig Jahre Torah MiTzion, ein Foto nach dem anderen: Schlichim, Familien, Gemeinden, Feiern – aus jedem Kollel und jedem Jahr seit 1996. Wir stellen das Album zusammen, und die Bilder, die Sie aufbewahrt haben, sind genau die, die darin noch fehlen.\n\nSchicken Sie einfach ein Foto hierher. Ich stelle ein, zwei kurze Fragen, damit es im richtigen Jahr mit den richtigen Namen landet. Alt, unscharf, gescannt – alles willkommen.\n\nWaren Sie Schaliach oder Schlicha? Schicken Sie ein Bild von sich mit den Worten „das bin ich“ und Ihrem Namen – es erscheint neben Ihrem Namen.',
    hello: 'Hallo nochmal! Schicken Sie ein Foto, wann immer Sie mögen — auch mehrere hintereinander.',
    nophoto: 'Schicken Sie ein Foto, wann es passt. Alte Abzüge, Scans, Handyfotos — alles aus einer Torah-MiTzion-Gemeinde.',
    got: 'Angekommen, danke! 🙏',
    ask: {
      community: 'Aus welcher Gemeinde stammt es? (Memphis, Kapstadt, Moskau…)',
      year: 'Und ungefähr aus welchem Jahr?',
      people: 'Wer ist auf dem Foto? Vornamen reichen — so viele Sie noch wissen.',
      occasion: 'Was war der Anlass? Ein Schabbaton, ein Schiur, ein Abschied, ein ganz normaler Tag…'
    },
    noted: 'Notiert. ',
    complete: 'Wunderbar — das ist alles. Es ist jetzt auf der Website! 🎉',
    completeHeld: 'Wunderbar – das ist alles. Es ist gut angekommen und nimmt bald seinen Platz im Album ein.',
    more: '\n\nHaben Sie noch mehr aus dem Jahr, oder aus einem anderen? Schicken Sie sie, wann Sie mögen.',
    dupe: 'Das haben wir schon — trotzdem danke! Noch eins?',
    unclear: 'Das habe ich nicht ganz verstanden. ',
    refuse: {
      nopeople: 'Danke fürs Schicken. In diesem Album geht es um Menschen – Gemeinden, Schlichim, Familien –, deshalb nehmen wir nur Fotos mit Personen darauf. Alles mit Gesichtern ist sehr willkommen.',
      notphoto: 'Das sieht nach einer Grafik oder Zeichnung aus, nicht nach einem Foto, deshalb kann ich es nicht aufnehmen. Ein Foto vom Echten — auch ein Scan eines alten Abzugs — wäre perfekt.',
      sexual: 'Das kann ich nicht aufnehmen – es scheint Nacktheit oder etwas Intimes zu zeigen, und das Album ist für alle offen.',
      violence: 'Das kann ich nicht aufnehmen – es scheint eine Verletzung oder Gewalt zu zeigen, und das Album ist für alle offen.',
      advert: 'Das sieht nach einer Anzeige oder einem Flyer aus, und das Album enthält nur Fotos von Menschen. Ein Foto von der Veranstaltung selbst wäre großartig.',
      screenshot: 'Das sieht nach einem Screenshot oder Meme aus, nicht nach einem Foto, deshalb kann ich es nicht aufnehmen. Das Originalfoto wäre perfekt.',
      document: 'Das sieht nach einem Dokument mit persönlichen Daten aus, das kann ich nicht auf eine öffentliche Website stellen. Ein Foto von Menschen wäre willkommen.',
      unclear: 'Ich konnte es nicht klar genug erkennen, um sicher zu sein, dass es veröffentlicht werden kann. Könnten Sie eine schärfere Kopie oder das Original schicken?',
      toobig: 'Das ist etwas zu groß für mich. Schicken Sie es als normales Bild und nicht als Datei, dann wird es sofort aufgenommen.',
      badfile: 'Ich konnte die Datei nicht als Foto lesen. JPEG, PNG oder WebP funktionieren — versuchen Sie, es als normales Bild zu schicken.',
      generic: 'Das kann ich leider nicht aufnehmen.'
    },
    fetchfail: 'Entschuldigung — ich konnte es nicht herunterladen. Das liegt an mir, nicht an Ihnen. Könnten Sie es noch einmal schicken?',
    paused: 'Ich musste dieses Gespräch nach mehreren Fotos, die ich nicht annehmen konnte, für einen Tag pausieren. Morgen gern wieder.',
    slowdown: 'Sie haben in kurzer Zeit viel geschickt — danke! Geben Sie mir ein paar Minuten zum Aufholen, dann weiter.',
    missed: 'Entschuldigung — ich habe Ihre letzte Nachricht offenbar verpasst. Das war mein Fehler. Könnten Sie sie noch einmal schicken? Wenn es ein Foto war, einfach noch einmal senden.',
    reminder: 'Ihr Foto von gestern wartet noch auf ein Detail, bevor es online gehen kann. ',
    seeIt: 'Hier ist es auf der Website zu sehen:\n{url}',
    portraitHint: 'Waren Sie Schaliach oder Schlicha? Schicken Sie ein Bild von sich mit den Worten „das bin ich“ und Ihrem Namen – es erscheint neben Ihrem Namen.',
    pitch1: 'Damit das Album jedes dieser dreißig Jahre voll wird, freuen wir uns, wenn Sie das mit Schlichim, Gemeindemitgliedern und Weggefährten teilen.',
    pitch2: '📷 Dreißig Jahre Torah MiTzion in Fotos – jedes Kollel, jedes Jahr seit 1996.\nFinden Sie Ihr Jahr: {site}\nSchicken Sie die Bilder, die Sie aufbewahrt haben, direkt aus WhatsApp: {wa}',
    pitch3: 'Wir freuen uns, wenn Sie diese Nachricht weiterleiten 🙏 – und wenn Sie noch Fotos haben, schicken Sie sie hierher.',
    portraitLinked: 'Schön — das wird Ihr Bild auf der Seite, neben {name}. ',
    portraitWhich: 'Ich habe mehrere Personen mit diesem Namen gefunden: {list}. In welcher Gemeinde waren Sie, damit ich weiß, wer Sie sind?',
    portraitNone: 'Diesen Namen finde ich nicht im Register. Wie wird er auf Hebräisch oder Englisch geschrieben?',
    blocked: ''
  },
  es: {
    welcome: 'Hola, y bienvenido. 📷\n\nTreinta años de Torah MiTzion, una fotografía a la vez: shlijim, familias, comunidades, celebraciones — de cada kolel y cada año desde 1996. Estamos armando el álbum, y las fotos que guardaste son justo las que todavía le faltan.\n\nSimplemente envía una fotografía aquí. Te haré un par de preguntas rápidas para que llegue a su año con los nombres correctos. Antigua, borrosa, escaneada — todo es bienvenido.\n\n¿Fuiste shaliaj o shlijá? Envía una foto tuya con las palabras «este soy yo» y tu nombre, y aparecerá junto a tu nombre.',
    hello: '¡Hola de nuevo! Envíe una fotografía cuando quiera — puedo recibir varias seguidas.',
    nophoto: 'Envíe una fotografía cuando esté listo. Copias antiguas, escaneos, fotos de teléfono — cualquier cosa de una comunidad Torah MiTzion.',
    got: '¡Recibida, gracias! 🙏',
    ask: {
      community: '¿De qué comunidad es? (Memphis, Ciudad del Cabo, Moscú…)',
      year: '¿Y de qué año, aproximadamente?',
      people: '¿Quién aparece en la fotografía? Con los nombres basta — todos los que recuerde.',
      occasion: '¿Cuál era la ocasión? Un shabatón, una clase, una despedida, un día cualquiera…'
    },
    noted: 'Anotado. ',
    complete: 'Estupendo — eso es todo. ¡Ya está en el sitio! 🎉',
    completeHeld: 'Estupendo — eso es todo. Ya está con nosotros y pronto ocupará su lugar en el álbum.',
    more: '\n\n¿Tiene más de ese año, o de otro? Envíelas cuando quiera.',
    dupe: 'Esa ya la tenemos — ¡gracias de todos modos! ¿Tiene otra?',
    unclear: 'No lo he entendido del todo. ',
    refuse: {
      nopeople: 'Gracias por enviarla. Este álbum trata de las personas — las comunidades, los shlijim, las familias — así que solo podemos aceptar fotografías con personas. Cualquier foto con rostros es muy bienvenida.',
      notphoto: 'Eso parece un gráfico o un dibujo más que una fotografía, así que no puedo añadirlo. Una foto de lo real — incluso un escaneo de una copia antigua — sería perfecta.',
      sexual: 'Esa no puedo añadirla — parece mostrar desnudez o algo íntimo, y el álbum está abierto a todos.',
      violence: 'Esa no puedo añadirla — parece mostrar una lesión o violencia, y el álbum está abierto a todos.',
      advert: 'Eso parece un anuncio o un folleto, y el álbum solo contiene fotografías de personas. Una foto del evento en sí sería genial.',
      screenshot: 'Eso parece una captura de pantalla o un meme más que una fotografía, así que no puedo añadirlo. La foto original sería perfecta.',
      document: 'Eso parece un documento con datos personales, así que no puedo ponerlo en un sitio público. Una fotografía de personas sería bienvenida.',
      unclear: 'No pude verla con suficiente claridad para estar seguro de que se puede publicar. ¿Podría enviar una copia más nítida, o el original?',
      toobig: 'Esa es un poco grande para mí. Envíela como foto normal y no como archivo o documento, y entrará enseguida.',
      badfile: 'No pude leer ese archivo como fotografía. JPEG, PNG o WebP funcionan — intente enviarla como foto normal.',
      generic: 'Esa no puedo añadirla, lo siento.'
    },
    fetchfail: 'Lo siento — no pude descargar esa. Es un fallo mío, no suyo. ¿Podría enviarla de nuevo?',
    paused: 'He tenido que pausar esta conversación un día tras varias fotografías que no pude aceptar. Bienvenido de nuevo mañana.',
    slowdown: 'Ha enviado mucho en poco tiempo — ¡gracias! Deme unos minutos para ponerme al día y siga.',
    missed: 'Lo siento — parece que me perdí su último mensaje. Fue culpa mía. ¿Podría enviarlo de nuevo? Si era una fotografía, simplemente envíela otra vez.',
    reminder: 'Tu fotografía de ayer todavía espera un detalle antes de poder publicarse. ',
    seeIt: 'Puedes verla en el sitio aquí:\n{url}',
    portraitHint: '¿Fuiste shaliaj o shlijá? Envía una foto tuya con las palabras «este soy yo» y tu nombre, y aparecerá junto a tu nombre.',
    pitch1: 'Para llenar el álbum de cada uno de estos treinta años, nos encantaría que compartieras esto con shlijim, miembros de las comunidades y compañeros de camino.',
    pitch2: '📷 Treinta años de Torah MiTzion en fotografías: cada kolel, cada año desde 1996.\nEncuentra tu año: {site}\nEnvía las fotos que guardaste, directo desde WhatsApp: {wa}',
    pitch3: 'Nos alegraría que reenviaras este mensaje 🙏 — y si tienes más fotografías, envíalas aquí.',
    portraitLinked: 'Perfecto — esa será tu foto en el sitio, junto a {name}. ',
    portraitWhich: 'Encontré a más de una persona con ese nombre: {list}. ¿En qué comunidad estuviste, para saber cuál eres?',
    portraitNone: 'No encontré ese nombre en el registro. ¿Cómo se escribe en hebreo o en inglés?',
    blocked: ''
  }
};

export const SUPPORTED = Object.keys(S) as Lang[];
export const say = (lang: string): Strings => S[lang as Lang] ?? S.en;

/* Six languages are written by hand above. Everyone else — Portuguese, Italian,
   Dutch, Yiddish, whatever a diaspora of thirty years speaks — gets the same
   sentence translated once by the model and remembered for the life of the
   worker. The rule is the sender's language, not ours: a person who writes in
   Portuguese is answered in Portuguese, full stop. */
let MODEL = '', KEY = '';
export function configureSay(model: string, key: string) { MODEL = model; KEY = key; }

const cache = new Map<string, string>();

export async function phrase(lang: string, pick: (s: Strings) => string): Promise<string> {
  const l = (lang || 'en').toLowerCase().slice(0, 5);
  if (SUPPORTED.includes(l as Lang)) return pick(say(l));
  const english = pick(S.en);
  if (!KEY) return english;
  const k = `${l} ${english}`;
  const hit = cache.get(k);
  if (hit) return hit;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            `Translate this WhatsApp message into the language with ISO code "${l}". Keep the tone (warm, brief), keep emoji, keep line breaks, do not add anything. Return ONLY the translation.

${english}` }] }],
          generationConfig: { temperature: 0.2 }
        }) });
    if (!res.ok) return english;
    const out = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!out) return english;
    cache.set(k, out);
    return out;
  } catch { return english; }
}

/* refusalFor, for any language: pick the right refusal, then localise it. */
export async function refusalIn(lang: string, reasons: string[], scores: Record<string, number> = {}) {
  return phrase(lang, s => {
    /* same selection as refusalFor, applied to whichever Strings phrase() chose */
    const r = s.refuse;
    const text = reasons.join(' ').toLowerCase();
    const over = (k: string, n: number) => typeof scores[k] === 'number' && scores[k] >= n;
    if (text.includes('nobody in the picture')) return r.nopeople;
    if (text.includes('not a photograph')) return r.notphoto;
    if (text.includes('sexual') || over('sexual', 45)) return r.sexual;
    if (text.includes('violence') || text.includes('injur') || over('violence', 55)) return r.violence;
    if (text.includes('advert') || text.includes('promot') || text.includes('flyer') || over('advertising', 65)) return r.advert;
    if (text.includes('screenshot') || text.includes('meme') || over('screenshot', 70)) return r.screenshot;
    if (text.includes('document') || text.includes('private') || over('private_document', 55)) return r.document;
    if (text.includes('confidence')) return r.unclear;
    if (text.includes('too large') || text.includes('too many pixels')) return r.toobig;
    if (text.includes('not a jpeg') || text.includes('unreadable') || text.includes('decode')) return r.badfile;
    return r.generic;
  });
}

/* Turns the screener's reasons into the sentence the sender hears. The
   screener speaks in codes because it is a machine; the sender gets a reason
   because they are a person who just did something generous. */
export function refusalFor(lang: string, reasons: string[], scores: Record<string, number> = {}): string {
  const r = say(lang).refuse;
  const text = reasons.join(' ').toLowerCase();
  const over = (k: string, n: number) => typeof scores[k] === 'number' && scores[k] >= n;

  if (text.includes('nobody in the picture')) return r.nopeople;
  if (text.includes('not a photograph')) return r.notphoto;
  if (text.includes('sexual') || over('sexual', 45)) return r.sexual;
  if (text.includes('violence') || text.includes('injur') || over('violence', 55)) return r.violence;
  if (text.includes('advert') || text.includes('promot') || text.includes('flyer') || over('advertising', 65)) return r.advert;
  if (text.includes('screenshot') || text.includes('meme') || over('screenshot', 70)) return r.screenshot;
  if (text.includes('document') || text.includes('private') || over('private_document', 55)) return r.document;
  if (text.includes('confidence')) return r.unclear;
  if (text.includes('too large') || text.includes('too many pixels')) return r.toobig;
  if (text.includes('not a jpeg') || text.includes('unreadable') || text.includes('decode')) return r.badfile;
  return r.generic;
}
