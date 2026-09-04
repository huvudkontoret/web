huvudkontoret // filpaket v0.2 // 2026-08-26
For extern anvandning: press, kunder, partners, arrangorer.


INNEHALL
  hk-sigill-black.svg       sigillet i Blaeck, for ljusa ytor
  hk-sigill-papper.svg      sigillet i Papper, for moerka ytor
  hk-sigill-signal.svg      sigillet i Signal, endast dar en yta kraver det
  png/                      36 transparenta PNG + 12 kvadratiska, se nedan
  huvudkontoret-farger.css  alla farger som CSS-variabler
  huvudkontoret-farger.json samma farger som data


FILERNA AR LASTA
  Anvand dem som de ar. Satt inte om dem, farga inte om dem, bygg inte
  vidare pa dem. Behover du nagot som inte finns i mappen: hej@huvudkontoret.io


PNG-FILERNA
  Sex marken, tva farglagen, tre grader. Namnet sager vilket:

    hk-wordmark-punkt      ordbilden med punkt. Grundformen.
    hk-wordmark            ordbilden utan punkt. For loepande text.
    hk-wordmark-stack      radbruten, huvud- / kontoret.
    hk-lockup-horisontell  sigill + enradig ordbild. Tyngsta avsandarformen.
    hk-lockup-monumental   sigill over radbruten stack. Poster, omslag, scen.
    hk-sigill              sigillet ensamt.

  Farglaget star efter market:

    -black    Blaeck #16150F. Pa ljus yta.
    -papper   Papper #F4F2EC. Pa moerk yta.

  Graden star sist: -1x, -2x, -4x. Valj den som ar storre an ytan du
  ska fylla, aldrig mindre. Skala aldrig upp en PNG.

  Alla dessa har transparent bakgrund, och frizonen ligger inbakad
  som transparent kant. Beskar dem inte.


DE KVADRATISKA
  Fyra filer i tre grader, och de enda i paketet med egen bakgrund.
  Skalet ar att en profilbild alltid beskars och alltid ligger pa en
  yta vi inte styr, alltsa ska ytan komma fran oss.

    hk-profilbild-ljus / -mork   ordbild och sigill i kvadrat
    hk-ikon-ljus / -mork         bara sigillet, for favicon och appikon

  Valj ljus eller moerk efter vad plattformen omger den med.


FRIZON
  Sigillet: ett strecks bredd, alltsa en sjattedel av sigillets hojd,
  pa alla fyra sidor.
  Ordbilden: ett teckens bredd runtom, alltsa 0,64 em i MonoLisa.
  I PNG-filerna ligger frizonen inne som transparent kant, samma varde pa
  alla sex marken. Ordbildens frizon ar ett forslag: bara sigillets ar last.


MINSTA STORLEK
  Sigillet 16 px pa skarm, 6 mm i tryck.
  Ordbilden 12 px pa skarm, 8 pt i tryck.
  Den horisontella lockupen mats pa ordbilden, inte pa sigillet.


FARG
  Tva lagen och inga andra: Blaeck pa ljus yta, Papper pa moerk.
  Signal #D9481C ar punktens farg och blir aldrig en yta.
  Bindestrecket i den radbrutna formen ar Grafit #8A877D i bada lagen.


TYPSNITTET FOLJER INTE MED
  MonoLisa licensieras per anvandare och far inte vidaredistribueras.
  Paketet innehaller darfor ingen font. Behover du satta text i var
  typografi ar svaret att du inte ska: anvand filerna. Det ar hela
  skalet till att de finns.


GOR INTE
  Satt inte ordbilden i ett annat typsnitt.
  Rita inte om sigillet, och rita inte av det.
  Strack inte, rotera inte, luta inte. Skala proportionellt eller inte alls.
  Lagg inte pa skugga, gloed, kontur, gradient eller genomskinlighet.
  Farga inte om filerna.
  Lagg inte ordbilden pa foto eller moenster utan provad kontrast. Pa orolig
  botten anvands den kvadratiska filen med egen yta.
  Satt inte in punkten dar ingen punkt finns, och ta inte bort den dar den
  finns. Punkten ar forsta tecknet i en adress och hor till filen.
  Bygg inte en egen lockup av sigill plus ordbild. De tva lasta
  kombinationerna finns som filer, och avstanden i dem ar matta.
  Skriv inte Huvudkontoret med stor bokstav i loeptext. Det juridiska namnet
  ar Huvudkontoret Norr AB och anvands bara dar den juridiska personen menas.


ANDRAT SEDAN v0.1
  v0.1 sa att ordbilden aldrig exporteras som bild utan satts pa plats.
  Regeln galler fortfarande internt. Externt galler den inte, eftersom
  MonoLisa inte far vidaredistribueras och en mottagare utan fonten da
  satter ordbilden i nagot annat. Darfor levereras ordbilden som fil.
  Priset ar att filer aldras. Paketet har darfor version och datum, och
  har du en aldre mapp liggande: hamta om.
