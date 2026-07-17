/* ============================================
   YuPe Agência — script.js
   Bloco 1: header, menu mobile, reveal
============================================ */
(function () {
  'use strict';

  var WHATSAPP = '5541995107048';

  /* ---------- CRM: planilha via Google Apps Script ----------
     Cole aqui a URL que o Apps Script gerar (termina com /exec).
     Deixando vazio, o site funciona igual e não envia nada.
     Instruções completas no arquivo apps-script.gs
  ------------------------------------------------------------ */
  var CRM_URL = 'https://script.google.com/macros/s/AKfycbxpgm61ECMuiC9Mr2vTl-CSJ4uZBiisLqqEY_W0UXc2SWyv6SB3cxh9uXYgZCfBFLY2/exec';

  /* Envia sem travar o site. Se o CRM cair, o lead vai pro
     WhatsApp do mesmo jeito: o envio é paralelo, não bloqueante. */
  function enviarCRM(payload, usarBeacon) {
    if (!CRM_URL) return;

    var corpo = JSON.stringify(payload);

    try {
      // ao sair da página, o fetch é cancelado. sendBeacon não é.
      if (usarBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(CRM_URL, new Blob([corpo], { type: 'text/plain;charset=utf-8' }));
        return;
      }

      // text/plain evita o preflight, que o Apps Script não responde
      fetch(CRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: corpo,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- 00. CONSENTIMENTO E META PIXEL (LGPD) ----------
     O pixel só é carregado depois do aceite. Sem consentimento,
     nenhum rastreamento roda e nenhum evento é enviado ao Meta.
  ------------------------------------------------------------ */
  var PIXEL_ID = '1538909137732787';
  var CHAVE_CONSENTIMENTO = 'yupe_cookies';
  var pixelCarregado = false;
  var filaEventos = [];

  function consentimento() {
    try { return localStorage.getItem(CHAVE_CONSENTIMENTO); }
    catch (e) { return null; }
  }

  function carregarPixel() {
    if (pixelCarregado) return;
    pixelCarregado = true;

    /* código oficial do Meta, injetado só agora */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');

    // dispara o que aconteceu antes do aceite
    filaEventos.forEach(function (ev) {
      window.fbq(ev.custom ? 'trackCustom' : 'track', ev.nome, ev.dados);
    });
    filaEventos = [];
  }

  /* Se ainda não houve aceite, o evento fica na fila.
     Se o visitante recusou, o evento é descartado. */
  function track(nome, dados, custom) {
    var escolha = consentimento();
    if (escolha === 'recusado') return;

    if (!pixelCarregado) {
      if (escolha === 'aceito') carregarPixel();
      else { filaEventos.push({ nome: nome, dados: dados || {}, custom: custom }); return; }
    }

    if (typeof window.fbq !== 'function') return;
    try { window.fbq(custom ? 'trackCustom' : 'track', nome, dados || {}); }
    catch (e) {}
  }

  /* ---------- 01. HEADER: borda ao rolar ---------- */
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 02. MENU MOBILE ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };

    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });

    // fecha com ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false);
    });

    // fecha ao voltar pro desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth > 940 && nav.classList.contains('open')) setMenu(false);
    });
  }

  /* ---------- 03. REVEAL AO ROLAR ---------- */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el, i) {
      // escalona levemente os elementos do mesmo bloco
      el.style.transitionDelay = (Math.min(i, 5) * 70) + 'ms';
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 04. QUIZ DE QUALIFICAÇÃO ---------- */
  var quiz = document.getElementById('quiz');

  if (quiz) {
    var panel    = quiz.querySelector('.quiz-panel');
    var body     = document.getElementById('quiz-body');
    var steps    = quiz.querySelectorAll('.qstep');
    var elBar    = document.getElementById('quiz-bar');
    var elCur    = document.getElementById('quiz-cur');
    var elBack   = document.getElementById('quiz-back');
    var elNext   = document.getElementById('quiz-next');
    var elErr    = document.getElementById('quiz-err');

    var TOTAL = steps.length;
    var passo = 1;
    var ultimoFoco = null;
    var enviado = false;          // já virou lead completo
    var abandonoRegistrado = false; // evita gravar duas vezes

    var dados = {
      servico: '', objetivo: '', momento: '', prazo: '', verba: '',
      nome: '', whatsapp: '', empresa: '', mensagem: ''
    };

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /* --- o passo atual está completo? --- */
    function passoOk() {
      if (passo === 1) return !!dados.servico;
      if (passo === 2) return !!dados.objetivo;
      if (passo === 3) return !!dados.momento;
      if (passo === 4) return !!dados.prazo && !!dados.verba;
      if (passo === 5) {
        return dados.nome.trim().length > 1 &&
               dados.whatsapp.replace(/\D/g, '').length >= 10;
      }
      return false;
    }

    /* --- redesenha --- */
    function render() {
      steps.forEach(function (s) {
        s.classList.toggle('is-active', Number(s.dataset.step) === passo);
      });

      elBar.style.width = ((passo / TOTAL) * 100) + '%';
      elCur.textContent = pad(passo);
      elBack.classList.toggle('is-on', passo > 1);

      elNext.innerHTML = (passo === TOTAL)
        ? 'Pedir orçamento no WhatsApp <span class="arw">→</span>'
        : 'Continuar <span class="arw">→</span>';

      elNext.disabled = !passoOk();
      if (body) body.scrollTop = 0;
    }

    /* --- abrir e fechar --- */
    function abrir(servico) {
      ultimoFoco = document.activeElement;
      quiz.hidden = false;
      document.body.style.overflow = 'hidden';

      if (servico) {
        var alvo = quiz.querySelector('.qopt[data-value="' + servico + '"]');
        if (alvo) {
          marcar(alvo);
          passo = 2;
        }
      }

      render();
      setTimeout(function () { panel.focus(); }, 60);

      track('QuizIniciado', { servico: servico || 'nao definido' }, true);
    }

    function fechar() {
      quiz.hidden = true;
      document.body.style.overflow = '';
      if (ultimoFoco) ultimoFoco.focus();
    }

    /* --- zera tudo (usado depois de enviar) --- */
    function resetar() {
      Object.keys(dados).forEach(function (k) { dados[k] = ''; });
      quiz.querySelectorAll('.qopt').forEach(function (o) { o.classList.remove('is-picked'); });
      quiz.querySelectorAll('input[data-field], textarea[data-field]').forEach(function (el) { el.value = ''; });
      if (elErr) elErr.hidden = true;
      passo = 1;
      render();
    }

    /* --- abandono: quem começou o quiz e foi embora ---
       Fechar o modal não conta, porque a pessoa pode reabrir.
       O que conta é sair da página sem ter enviado.
       É isso que mostra em qual pergunta as pessoas travam. */
    function registrarAbandono() {
      if (enviado || abandonoRegistrado) return;
      if (!dados.servico) return; // nem chegou a responder nada

      abandonoRegistrado = true;
      enviarCRM({
        tipo: 'abandonado',
        passo: passo,
        servico: dados.servico,
        objetivo: dados.objetivo,
        momento: dados.momento,
        prazo: dados.prazo,
        verba: dados.verba
      }, true); // true = sendBeacon, sobrevive ao fechamento da aba
    }

    window.addEventListener('pagehide', registrarAbandono);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') registrarAbandono();
    });

    /* --- marcar opção --- */
    function marcar(btn) {
      var grupo = btn.closest('.qopts');
      grupo.querySelectorAll('.qopt').forEach(function (o) {
        o.classList.remove('is-picked');
      });
      btn.classList.add('is-picked');
      dados[grupo.dataset.field] = btn.dataset.value;
    }

    /* --- mensagem que chega no seu WhatsApp --- */
    function montarMensagem() {
      var L = [];
      L.push('Olá! Vim pelo site da YuPe.');
      L.push('');
      L.push('Preciso de: ' + dados.servico);
      L.push('Objetivo: ' + dados.objetivo);
      L.push('Momento: ' + dados.momento);
      L.push('Prazo: ' + dados.prazo);
      L.push('Investimento previsto: ' + dados.verba);
      L.push('');
      L.push('Nome: ' + dados.nome);
      if (dados.empresa) L.push('Empresa: ' + dados.empresa);
      L.push('WhatsApp: ' + dados.whatsapp);
      if (dados.mensagem) {
        L.push('');
        L.push('Sobre o negócio: ' + dados.mensagem);
      }
      return L.join('\n');
    }

    /* --- opções --- */
    quiz.querySelectorAll('.qopt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        marcar(btn);
        elNext.disabled = !passoOk();

        // passos de escolha única avançam sozinhos
        if (passo < 4 && passoOk()) {
          setTimeout(function () {
            if (passo < TOTAL) { passo++; render(); }
          }, 220);
        }
      });
    });

    /* --- campos de texto --- */
    quiz.querySelectorAll('input[data-field], textarea[data-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        dados[el.dataset.field] = el.value;
        elNext.disabled = !passoOk();
        if (elErr && !elErr.hidden && passoOk()) elErr.hidden = true;
      });
    });

    /* --- continuar / enviar --- */
    elNext.addEventListener('click', function () {
      if (!passoOk()) {
        if (passo === TOTAL && elErr) elErr.hidden = false;
        return;
      }

      if (passo < TOTAL) {
        passo++;
        render();
        if (passo === TOTAL) {
          var primeiro = document.getElementById('q-nome');
          if (primeiro) setTimeout(function () { primeiro.focus(); }, 80);
        }
        return;
      }

      // INTEGRAÇÃO CRM: descomente quando o webhook existir.
      // fetch('https://SEU-BACKEND/webhook/lead', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(Object.assign({ origem: 'site-quiz' }, dados))
      // });

      // evento de conversão: é ele que deixa o Meta otimizar campanha
      track('Lead', {
        content_name: dados.servico,
        content_category: dados.objetivo,
        prazo: dados.prazo,
        faixa_verba: dados.verba
      });

      // grava na planilha
      enviarCRM({
        tipo: 'completo',
        origem: 'site-quiz',
        nome: dados.nome,
        whatsapp: dados.whatsapp,
        empresa: dados.empresa,
        servico: dados.servico,
        objetivo: dados.objetivo,
        momento: dados.momento,
        prazo: dados.prazo,
        verba: dados.verba,
        mensagem: dados.mensagem
      });
      enviado = true;

      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(montarMensagem()), '_blank');
      fechar();
      resetar();
    });

    elBack.addEventListener('click', function () {
      if (passo > 1) { passo--; render(); }
    });

    /* --- gatilhos do site --- */
    document.querySelectorAll('[data-open-quiz]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        abrir(btn.dataset.service || '');
      });
    });

    /* --- fechar --- */
    quiz.querySelectorAll('[data-close-quiz]').forEach(function (el) {
      el.addEventListener('click', fechar);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !quiz.hidden) fechar();
    });

    /* --- prende o foco dentro do modal --- */
    quiz.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || quiz.hidden) return;
      var foco = panel.querySelectorAll('button:not([disabled]), input, textarea, a[href]');
      if (!foco.length) return;
      var primeiro = foco[0], ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primeiro.focus();
      }
    });

    panel.setAttribute('tabindex', '-1');
  }

  /* ---------- 05. WHATSAPP DIRETO: também é lead ---------- */
  // Quem pula o quiz e chama no zap não pode sumir do radar do pixel.
  document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
    link.addEventListener('click', function () {
      var onde = link.classList.contains('fab') ? 'botao flutuante'
               : link.closest('.footer') ? 'rodape'
               : link.closest('.header') ? 'topo'
               : 'pagina';
      track('Contact', { origem: onde });
    });
  });

  /* ---------- 06. BANNER DE COOKIES (LGPD) ---------- */
  var banner = document.getElementById('cookies');

  if (banner) {
    var btnAceitar = document.getElementById('cookies-aceitar');
    var btnRecusar = document.getElementById('cookies-recusar');
    var btnRever = document.getElementById('rever-cookies');

    function salvarEscolha(valor) {
      try { localStorage.setItem(CHAVE_CONSENTIMENTO, valor); } catch (e) {}
      banner.hidden = true;
      if (valor === 'aceito') carregarPixel();
    }

    function mostrarBanner() {
      banner.hidden = false;
    }

    // decide o que fazer ao abrir a página
    var escolha = consentimento();
    if (escolha === 'aceito') {
      carregarPixel();
    } else if (escolha !== 'recusado') {
      // ainda não escolheu: mostra o aviso sem atrapalhar a leitura
      setTimeout(mostrarBanner, 900);
    }

    btnAceitar.addEventListener('click', function () { salvarEscolha('aceito'); });
    btnRecusar.addEventListener('click', function () { salvarEscolha('recusado'); });

    // permite mudar de ideia depois, pelo rodapé
    if (btnRever) {
      btnRever.addEventListener('click', function () {
        try { localStorage.removeItem(CHAVE_CONSENTIMENTO); } catch (e) {}
        filaEventos = [];
        mostrarBanner();
      });
    }
  }

})();