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
  blocked: string;
};

const S: Record<Lang, Strings> = {
  en: {
    welcome: 'Hello, and welcome to the Torah MiTzion 30 photograph archive. 📷\n\nWe are gathering photographs from thirty years of kollels around the world — shlichim, families, communities, celebrations — and we would love yours.\n\nJust send a photograph here. I will ask you a couple of quick questions about it so it can go on the site with a name and a year. Old, blurry, scanned — all welcome.',
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
    completeHeld: 'Wonderful — that is everything. It is in the archive and will appear on the site shortly.',
    more: '\n\nHave more from that year, or from another one? Send them whenever you like.',
    dupe: 'We already have that one — thank you all the same! Have another?',
    unclear: 'I did not quite catch that. ',
    refuse: {
      nopeople: 'Thank you for sending it. This archive is about the people — the communities, the shlichim, the families — so we can only take photographs with people in them. Anything with faces is very welcome.',
      notphoto: 'That looks like a graphic or a drawing rather than a photograph, so I cannot add it. A photo of the real thing — even a scan of an old print — would be perfect.',
      sexual: 'I cannot add that one — it looks like it shows nudity or something intimate, and the archive is public.',
      violence: 'I cannot add that one — it looks like it shows injury or violence, and the archive is public.',
      advert: 'That looks like an advertisement or a flyer, and the archive only holds photographs of people. A photo from the event itself would be great.',
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
    blocked: ''
  },
  he: {
    welcome: 'שלום, וברוכים הבאים לארכיון התמונות של תורה מציון 30. 📷\n\nאנחנו אוספים תמונות משלושים שנות כוללים ברחבי העולם — שליחים, משפחות, קהילות, שמחות — ונשמח לשלכם.\n\nפשוט שלחו לכאן תמונה. אשאל כמה שאלות קצרות עליה כדי שתעלה לאתר עם שם ושנה. ישנה, מטושטשת, סרוקה — הכול מתקבל בברכה.',
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
    completeHeld: 'מצוין — זה הכול. התמונה בארכיון ותופיע באתר בקרוב.',
    more: '\n\nיש עוד מאותה שנה, או משנה אחרת? שלחו מתי שתרצו.',
    dupe: 'את זו כבר יש לנו — תודה בכל זאת! יש עוד אחת?',
    unclear: 'לא הבנתי בדיוק. ',
    refuse: {
      nopeople: 'תודה ששלחתם. הארכיון הזה הוא על האנשים — הקהילות, השליחים, המשפחות — אז אנחנו יכולים לקלוט רק תמונות שיש בהן אנשים. כל תמונה עם פנים תתקבל בשמחה.',
      notphoto: 'זה נראה כמו גרפיקה או איור ולא כמו תמונה, אז אי אפשר להוסיף. צילום של הדבר האמיתי — אפילו סריקה של תדפיס ישן — יהיה מושלם.',
      sexual: 'את זו אי אפשר להוסיף — נראה שיש בה עירום או משהו אינטימי, והארכיון ציבורי.',
      violence: 'את זו אי אפשר להוסיף — נראה שיש בה פציעה או אלימות, והארכיון ציבורי.',
      advert: 'זה נראה כמו פרסומת או פלייר, והארכיון מכיל רק תמונות של אנשים. תמונה מהאירוע עצמו תהיה נהדרת.',
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
    blocked: ''
  },
  ru: {
    welcome: 'Здравствуйте, и добро пожаловать в фотоархив «Тора МиЦион 30». 📷\n\nМы собираем фотографии тридцати лет колелей по всему миру — шлихим, семьи, общины, праздники — и будем рады вашим.\n\nПросто пришлите фотографию сюда. Я задам пару коротких вопросов, чтобы она попала на сайт с именем и годом. Старые, нечёткие, отсканированные — всё подходит.',
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
    completeHeld: 'Отлично — это всё. Фотография в архиве и скоро появится на сайте.',
    more: '\n\nЕсть ещё с того года или с другого? Присылайте, когда захотите.',
    dupe: 'Эта у нас уже есть — всё равно спасибо! Есть ещё?',
    unclear: 'Не совсем понял. ',
    refuse: {
      nopeople: 'Спасибо, что прислали. Этот архив — о людях: общинах, шлихим, семьях, — поэтому мы берём только фотографии с людьми. Любой снимок с лицами очень ждём.',
      notphoto: 'Это похоже на графику или рисунок, а не на фотографию, поэтому добавить не могу. Фото настоящего — даже скан старого снимка — будет то что нужно.',
      sexual: 'Эту добавить не могу — похоже, на ней обнажённость или что-то интимное, а архив публичный.',
      violence: 'Эту добавить не могу — похоже, на ней травма или насилие, а архив публичный.',
      advert: 'Это похоже на рекламу или флаер, а в архиве только фотографии людей. Фото с самого события было бы отлично.',
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
    blocked: ''
  },
  fr: {
    welcome: 'Bonjour, et bienvenue dans les archives photographiques Torah MiTzion 30. 📷\n\nNous rassemblons les photographies de trente ans de kollels à travers le monde — shlichim, familles, communautés, fêtes — et les vôtres nous feraient très plaisir.\n\nEnvoyez simplement une photographie ici. Je vous poserai deux ou trois questions rapides pour qu’elle figure sur le site avec un nom et une année. Ancienne, floue, scannée — tout est bienvenu.',
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
    completeHeld: 'Formidable — c’est tout. Elle est dans les archives et apparaîtra bientôt sur le site.',
    more: '\n\nVous en avez d’autres de cette année-là, ou d’une autre ? Envoyez-les quand vous voulez.',
    dupe: 'Celle-ci, nous l’avons déjà — merci quand même ! Une autre ?',
    unclear: 'Je n’ai pas bien compris. ',
    refuse: {
      nopeople: 'Merci de l’avoir envoyée. Ces archives parlent des gens — communautés, shlichim, familles — donc nous ne prenons que des photographies avec des personnes. Tout cliché avec des visages est le bienvenu.',
      notphoto: 'Cela ressemble à un graphisme ou un dessin plutôt qu’à une photographie, je ne peux donc pas l’ajouter. Une photo de la vraie chose — même un scan d’un vieux tirage — serait parfaite.',
      sexual: 'Je ne peux pas ajouter celle-ci — elle semble montrer de la nudité ou quelque chose d’intime, et les archives sont publiques.',
      violence: 'Je ne peux pas ajouter celle-ci — elle semble montrer une blessure ou de la violence, et les archives sont publiques.',
      advert: 'Cela ressemble à une publicité ou un prospectus, et les archives ne contiennent que des photographies de personnes. Une photo de l’événement lui-même serait idéale.',
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
    blocked: ''
  },
  de: {
    welcome: 'Hallo und willkommen im Fotoarchiv Torah MiTzion 30. 📷\n\nWir sammeln Fotos aus dreißig Jahren Kollels weltweit — Schlichim, Familien, Gemeinden, Feiern — und freuen uns über Ihre.\n\nSchicken Sie einfach ein Foto hierher. Ich stelle ein, zwei kurze Fragen dazu, damit es mit Namen und Jahr auf die Website kann. Alt, unscharf, gescannt — alles willkommen.',
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
    completeHeld: 'Wunderbar — das ist alles. Es ist im Archiv und erscheint bald auf der Website.',
    more: '\n\nHaben Sie noch mehr aus dem Jahr, oder aus einem anderen? Schicken Sie sie, wann Sie mögen.',
    dupe: 'Das haben wir schon — trotzdem danke! Noch eins?',
    unclear: 'Das habe ich nicht ganz verstanden. ',
    refuse: {
      nopeople: 'Danke fürs Schicken. In diesem Archiv geht es um Menschen — Gemeinden, Schlichim, Familien —, deshalb nehmen wir nur Fotos mit Personen darauf. Alles mit Gesichtern ist sehr willkommen.',
      notphoto: 'Das sieht nach einer Grafik oder Zeichnung aus, nicht nach einem Foto, deshalb kann ich es nicht aufnehmen. Ein Foto vom Echten — auch ein Scan eines alten Abzugs — wäre perfekt.',
      sexual: 'Das kann ich nicht aufnehmen — es scheint Nacktheit oder etwas Intimes zu zeigen, und das Archiv ist öffentlich.',
      violence: 'Das kann ich nicht aufnehmen — es scheint eine Verletzung oder Gewalt zu zeigen, und das Archiv ist öffentlich.',
      advert: 'Das sieht nach einer Anzeige oder einem Flyer aus, und das Archiv enthält nur Fotos von Menschen. Ein Foto von der Veranstaltung selbst wäre großartig.',
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
    blocked: ''
  },
  es: {
    welcome: 'Hola, y bienvenido al archivo fotográfico Torah MiTzion 30. 📷\n\nEstamos reuniendo fotografías de treinta años de kolelim en todo el mundo — shlijim, familias, comunidades, celebraciones — y nos encantaría tener las suyas.\n\nSimplemente envíe una fotografía aquí. Le haré un par de preguntas rápidas para que aparezca en el sitio con un nombre y un año. Antigua, borrosa, escaneada — todo es bienvenido.',
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
    completeHeld: 'Estupendo — eso es todo. Está en el archivo y aparecerá en el sitio en breve.',
    more: '\n\n¿Tiene más de ese año, o de otro? Envíelas cuando quiera.',
    dupe: 'Esa ya la tenemos — ¡gracias de todos modos! ¿Tiene otra?',
    unclear: 'No lo he entendido del todo. ',
    refuse: {
      nopeople: 'Gracias por enviarla. Este archivo trata de las personas — las comunidades, los shlijim, las familias — así que solo podemos incluir fotografías con gente. Cualquiera con rostros es muy bienvenida.',
      notphoto: 'Eso parece un gráfico o un dibujo más que una fotografía, así que no puedo añadirlo. Una foto de lo real — incluso un escaneo de una copia antigua — sería perfecta.',
      sexual: 'Esa no puedo añadirla — parece mostrar desnudez o algo íntimo, y el archivo es público.',
      violence: 'Esa no puedo añadirla — parece mostrar una lesión o violencia, y el archivo es público.',
      advert: 'Eso parece un anuncio o un folleto, y el archivo solo contiene fotografías de personas. Una foto del evento en sí sería genial.',
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
