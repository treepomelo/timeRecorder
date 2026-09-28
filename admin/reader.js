(function () {
    'use strict';

    const book = JSON.parse(localStorage.getItem('stpageflip-book') || '{}');
    const themes = {
        cream: { paper: '#fdfaf7', ink: '#785e3a', accent: '#785e3a', bg: '#f5f3f1' },
        sakura: { paper: '#fff4f6', ink: '#704954', accent: '#b15d78', bg: '#fff4f5' },
        night: { paper: '#252a3e', ink: '#eee6df', accent: '#cbb6a8', bg: '#161a29' },
        forest: { paper: '#edf3ea', ink: '#31483a', accent: '#557a61', bg: '#edf3ea' },
    };
    const theme = themes[book.theme] || themes.cream;
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (value) =>
        String(value || '').replace(/[&<>"']/g, (char) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
        );

    document.body.dataset.theme = book.theme || 'cream';
    $('navTitle').textContent = book.title || '礼物书';
    $('bookTitle').textContent = (book.title || '礼物书').toUpperCase();
    $('bookSubtitle').textContent = book.subtitle || '';

    function splitText(raw, limit) {
        const parts = [];
        let remaining = raw;

        while (remaining.length > limit) {
            let cut = -1;
            for (let i = limit; i > Math.floor(limit * 0.5); i--) {
                if (/[\s。！？!?；;，,、.:）)]/.test(remaining.charAt(i))) {
                    cut = i + 1;
                    break;
                }
            }

            if (cut < 0) cut = limit;
            parts.push(remaining.slice(0, cut));
            remaining = remaining.slice(cut);
        }

        parts.push(remaining);
        return parts;
    }

    const host = $('book');
    const hostWidth = Math.min(host.clientWidth || 1000, 1000);
    const pageHeight = host.clientHeight || 733;
    const isPortrait = hostWidth < 630;
    const pageWidth = Math.min(
        isPortrait ? hostWidth : hostWidth / 2,
        pageHeight * (550 / 733),
        500
    );
    const charsPerLine = Math.max(12, Math.floor((pageWidth - 40) / 13));
    const maxTextLines = window.innerWidth <= 700 ? 10 : 12;
    const source = [];

    (book.chapters || []).forEach((chapter) =>
        (chapter.pages || []).forEach((page) => {
            const raw = String(page.body || '');
            const visibleLines = Math.max(
                3,
                Math.min(maxTextLines, Number(page.lineCount) || 10)
            );
            const limit = Math.max(120, visibleLines * charsPerLine);

            splitText(raw, limit).forEach((text, index) =>
                source.push(
                    Object.assign({}, page, {
                        body: text,
                        visibleLines,
                        title: index
                            ? (page.title || '未命名') + ' · ' + (index + 1)
                            : page.title,
                    })
                )
            );
        })
    );

    const contentPageCount = source.length;
    const hasCover = contentPageCount > 0 && source[0].type === 'cover';
    const spreadOffset = hasCover ? 1 : 0;

    if (contentPageCount > 0 && (contentPageCount - spreadOffset) % 2 !== 0) {
        source.push({ isBlank: true, visibleLines: 3 });
    }

    function createPage(page, index) {
        const element = document.createElement('div');
        element.className =
            'page ' +
            (page.isBlank ? 'page-blank ' : '') +
            (page.type === 'cover' || page.type === 'ending' ? 'page-cover ' : '') +
            (page.type === 'letter' ? 'page-letter ' : '') +
            (page.type === 'image' ? 'page-image ' : '');
        element.style.setProperty('--paper', theme.paper);
        element.style.setProperty('--ink', theme.ink);
        element.style.setProperty('--accent', theme.accent);
        element.style.setProperty('--text-lines', page.visibleLines || 10);

        const content = document.createElement('div');
        content.className = 'page-content';

        const heading = document.createElement('h2');
        heading.className = 'page-header';
        heading.textContent = page.isBlank ? '' : page.title || '未命名页面';

        const image = document.createElement('div');
        image.className = 'page-image';
        if (!page.isBlank) {
            image.style.backgroundImage =
                'url(' +
                (page.imageUrl || '../work/demo/images/html/' + ((index % 8) + 1) + '.jpg') +
                ')';
        }

        const text = document.createElement('div');
        text.className = 'page-text';
        text.textContent = page.body || '';

        const footer = document.createElement('div');
        footer.className = 'page-footer';
        footer.textContent = page.isBlank ? '' : String(index + 1);

        content.append(heading, image, text, footer);
        element.appendChild(content);
        host.appendChild(element);
    }

    source.forEach(createPage);
    $('total').textContent = contentPageCount;

    const pageFlip = new St.PageFlip(host, {
        width: 550,
        height: 733,
        size: 'stretch',
        minWidth: 315,
        maxWidth: 500,
        minHeight: 420,
        maxHeight: 1350,
        maxShadowOpacity: 0.5,
        showCover: hasCover,
        mobileScrollSupport: false,
        usePortrait: true,
    });

    pageFlip.loadFromHTML(host.querySelectorAll('.page'));

    // The bundled demo renderer removes shadow nodes after an animation and may try to
    // remove the same nodes again on a later flip. Keep navigation usable until the
    // reader is switched to a freshly built library bundle.
    const renderer = pageFlip.getRender();
    const clearShadow = renderer.clearShadow.bind(renderer);
    renderer.clearShadow = () => {
        try {
            clearShadow();
        } catch (error) {
            if (!(error instanceof TypeError)) throw error;
        }
    };

    $('prev').onclick = () => pageFlip.flipPrev();
    $('next').onclick = () => pageFlip.flipNext();
    pageFlip.on(
        'flip',
        (event) => ($('num').textContent = Math.min(event.data + 1, contentPageCount))
    );
    pageFlip.on('changeState', (event) => ($('state').textContent = event.data));
    pageFlip.on('changeOrientation', (event) => ($('orientation').textContent = event.data));

    const audio = $('audio');
    const tracks = book.tracks || [];
    $('musicSelect').innerHTML = tracks
        .map(
            (track, index) =>
                '<option value="' +
                index +
                '">' +
                escapeHtml(track.name || 'BGM ' + (index + 1)) +
                '</option>'
        )
        .join('');

    function selectTrack(index) {
        const track = tracks[index];
        $('musicName').textContent = track ? track.name : '背景音乐';
        audio.src = (track && track.url) || '';
        $('musicHint').textContent = track && track.url ? '' : '请在管理端设置音频地址';
    }

    $('musicSelect').onchange = (event) => selectTrack(+event.target.value);
    $('musicVolume').oninput = (event) => (audio.volume = +event.target.value);
    $('musicPlay').onclick = async () => {
        if (!audio.src) {
            $('musicHint').textContent = '请先设置音频 URL';
            return;
        }

        if (audio.paused) {
            await audio.play();
            $('musicPlay').textContent = '暂停';
        } else {
            audio.pause();
            $('musicPlay').textContent = '播放';
        }
    };

    audio.volume = 0.7;
    selectTrack(0);
})();
