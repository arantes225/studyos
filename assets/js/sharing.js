(function () {
  const sb = window.supabaseClient;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  async function loadFriends() {
    if (!sb) return [];
    const { data, error } = await sb.rpc("my_friends");
    if (error) {
      console.warn("Não foi possível carregar amigos:", error.message);
      return [];
    }
    return data || [];
  }

  async function open(options = {}) {
    const {
      title = "Compartilhar",
      count = 0,
      allowExport = true,
      onLink,
      onExport,
      onFriend
    } = options;

    document.getElementById("luria-share-dialog")?.remove();

    const friends = await loadFriends();

    const dialog = document.createElement("dialog");
    dialog.id = "luria-share-dialog";
    dialog.className = "luria-share-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="luria-share-card">
        <div class="luria-share-head">
          <div>
            <small>Compartilhar</small>
            <h2>${esc(title)}</h2>
            <p>${count ? `${count} item${count === 1 ? "" : "s"} selecionado${count === 1 ? "" : "s"}` : ""}</p>
          </div>
          <button value="cancel" class="luria-share-close" aria-label="Fechar">×</button>
        </div>

        <div class="luria-share-options">
          <button type="button" class="luria-share-option" data-share-action="friend">
            <strong>Enviar dentro do LURIA</strong>
            <span>Escolha um amigo e envie diretamente.</span>
          </button>

          <button type="button" class="luria-share-option" data-share-action="link">
            <strong>Gerar link</strong>
            <span>Compartilhe com qualquer pessoa que tenha conta no LURIA.</span>
          </button>

          ${allowExport ? `
            <button type="button" class="luria-share-option" data-share-action="export">
              <strong>Exportar</strong>
              <span>Baixe o material em PDF.</span>
            </button>
          ` : ""}
        </div>

        <div class="luria-share-friends" hidden>
          <div class="luria-share-friends-head">
            <button type="button" data-share-back>←</button>
            <strong>Enviar para amigo</strong>
          </div>
          <div class="luria-share-friends-list">
            ${friends.length
              ? friends.map(friend => `
                  <button type="button" class="luria-share-friend" data-friend-id="${esc(friend.user_id)}">
                    <span class="luria-share-avatar">${esc((friend.display_name || "U").charAt(0).toUpperCase())}</span>
                    <span>
                      <strong>${esc(friend.display_name || "Usuário LURIA")}</strong>
                      <small>ID ${esc(friend.luria_id || "")}${friend.specialty ? " · " + esc(friend.specialty) : ""}</small>
                    </span>
                  </button>
                `).join("")
              : `<div class="luria-share-empty">Você ainda não adicionou amigos. Vá até <a href="/amigos/">Amigos</a> para adicionar por ID.</div>`
            }
          </div>
        </div>

        <div class="luria-share-status" aria-live="polite"></div>
      </form>
    `;

    if (!document.getElementById("luria-share-style")) {
      const style = document.createElement("style");
      style.id = "luria-share-style";
      style.textContent = `
        .luria-share-dialog{border:0;padding:0;background:transparent;max-width:min(92vw,520px);width:100%}
        .luria-share-dialog::backdrop{background:rgba(4,12,24,.55);backdrop-filter:blur(3px)}
        .luria-share-card{background:var(--surface,#fff);color:var(--text,#10243e);border:1px solid var(--border,#d9e2ec);border-radius:18px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.22)}
        .luria-share-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
        .luria-share-head small{color:var(--accent,#184888);font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
        .luria-share-head h2{margin:2px 0 3px;font-size:19px}
        .luria-share-head p{margin:0;color:var(--muted,#5f6f82);font-size:10px}
        .luria-share-close{border:0;background:transparent;color:var(--muted);font-size:25px;cursor:pointer}
        .luria-share-options,.luria-share-friends-list{display:grid;gap:8px}
        .luria-share-option,.luria-share-friend{width:100%;text-align:left;border:1px solid var(--border);background:var(--surface-2,#f1f5f9);color:var(--text);border-radius:12px;padding:12px;cursor:pointer}
        .luria-share-option strong,.luria-share-friend strong{display:block;font-size:11px}
        .luria-share-option span,.luria-share-friend small{display:block;margin-top:3px;color:var(--muted);font-size:8.5px}
        .luria-share-friends-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
        .luria-share-friends-head button{border:0;background:transparent;color:var(--text);cursor:pointer;font-size:18px}
        .luria-share-friend{display:flex;align-items:center;gap:10px}
        .luria-share-avatar{width:34px;height:34px;border-radius:50%;display:grid!important;place-items:center;background:var(--accent-soft,#e7eef7);color:var(--accent);font-weight:900}
        .luria-share-empty{padding:14px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);font-size:9px}
        .luria-share-status{min-height:16px;margin-top:10px;font-size:9px;color:var(--muted)}
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(dialog);

    const optionsView = dialog.querySelector(".luria-share-options");
    const friendsView = dialog.querySelector(".luria-share-friends");
    const status = dialog.querySelector(".luria-share-status");

    async function run(fn, success) {
      try {
        status.textContent = "Processando...";
        await fn?.();
        status.textContent = success || "Concluído.";
      } catch (error) {
        console.error(error);
        status.textContent = error?.message || "Não foi possível concluir.";
        throw error;
      }
    }

    dialog.querySelector('[data-share-action="friend"]')?.addEventListener("click", () => {
      optionsView.hidden = true;
      friendsView.hidden = false;
    });

    dialog.querySelector("[data-share-back]")?.addEventListener("click", () => {
      friendsView.hidden = true;
      optionsView.hidden = false;
    });

    dialog.querySelector('[data-share-action="link"]')?.addEventListener("click", async () => {
      try {
        await run(async () => {
          await onLink?.();
        }, "Link gerado.");
      } catch {}
    });

    dialog.querySelector('[data-share-action="export"]')?.addEventListener("click", async () => {
      try {
        await run(async () => {
          await onExport?.();
        }, "Exportação iniciada.");
      } catch {}
    });

    dialog.querySelectorAll("[data-friend-id]").forEach(button => {
      button.addEventListener("click", async () => {
        try {
          await run(async () => {
            await onFriend?.(button.dataset.friendId);
          }, "Material enviado dentro do LURIA.");
        } catch {}
      });
    });

    dialog.addEventListener("close", () => dialog.remove(), { once:true });
    dialog.showModal();
  }

  window.LuriaSharing = { open, loadFriends };
})();