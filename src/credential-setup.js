(function () {
    const auth = window.VirasatAuth;
    if (!auth || typeof auth.setCredentials !== "function") return;

    let account = null;
    let dismissed = false;
    let saving = false;

    const dialog = document.createElement("div");
    dialog.className = "credential-dialog";
    dialog.id = "credentialSetupDialog";
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "credentialTitle");
    dialog.innerHTML = [
        '<div class="credential-backdrop"></div>',
        '<section class="credential-card">',
        '<button id="credentialClose" class="credential-close" type="button" aria-label="Set up sign-in later">×</button>',
        '<div class="credential-eyebrow">Your Virasat account</div>',
        '<h2 id="credentialTitle">Choose how you sign in</h2>',
        '<p class="credential-description">Your Google account is connected. Add a username and password so you can also sign in without Google. Your saved places and plans stay in the same account.</p>',
        '<form id="credentialForm" novalidate>',
        '<label class="field-label" for="credentialUsername">Username</label>',
        '<input id="credentialUsername" class="field" name="username" type="text" inputmode="text" minlength="3" maxlength="32" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[A-Za-z0-9._-]{3,32}" required placeholder="e.g. your.name">',
        '<p class="credential-hint">3–32 characters. Letters, numbers, dots, underscores or hyphens.</p>',
        '<label class="field-label" for="credentialPassword">Password</label>',
        '<input id="credentialPassword" class="field" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="At least 8 characters">',
        '<label class="field-label" for="credentialConfirm">Confirm password</label>',
        '<input id="credentialConfirm" class="field" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Enter password again">',
        '<div id="credentialError" class="credential-error" role="alert" hidden></div>',
        '<button id="credentialSave" class="btn credential-submit" type="submit">Save sign-in details</button>',
        '</form>',
        '<button id="credentialLater" class="credential-later" type="button">I’ll set this up later</button>',
        '</section>'
    ].join("");

    document.body.appendChild(dialog);
    const $ = id => document.getElementById(id);
    const form = $("credentialForm");
    const error = $("credentialError");
    const save = $("credentialSave");

    function needsSetup(user) {
        return Boolean(user && user.google_sub && user.credentials_set === false);
    }

    function setError(message) {
        error.textContent = message || "";
        error.hidden = !message;
    }

    function close() {
        if (saving) return;
        dialog.hidden = true;
        document.body.classList.remove("credential-dialog-open");
    }

    function open() {
        if (!needsSetup(account) || saving) return;
        dialog.hidden = false;
        document.body.classList.add("credential-dialog-open");
        setError("");
        $("credentialUsername").focus();
    }

    function skip() {
        dismissed = true;
        close();
    }

    function onAccount(user) {
        account = user;
        if (!needsSetup(user)) {
            close();
            return;
        }
        if (!dismissed && dialog.hidden) open();
    }

    $("credentialClose").addEventListener("click", skip);
    $("credentialLater").addEventListener("click", skip);
    dialog.querySelector(".credential-backdrop").addEventListener("click", skip);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !dialog.hidden) skip();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (saving) return;
        const username = $("credentialUsername").value.trim();
        const password = $("credentialPassword").value;
        const confirmation = $("credentialConfirm").value;
        setError("");
        if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
            setError("Use 3–32 characters: letters, numbers, dots, underscores or hyphens.");
            $("credentialUsername").focus();
            return;
        }
        if (password.length < 8 || password.length > 128) {
            setError("Your password must contain 8–128 characters.");
            $("credentialPassword").focus();
            return;
        }
        if (password !== confirmation) {
            setError("Those passwords don't match. Please check and try again.");
            $("credentialConfirm").focus();
            return;
        }
        saving = true;
        save.disabled = true;
        save.textContent = "Saving your sign-in…";
        try {
            const result = await auth.setCredentials(username, password);
            if (!result || result.credentials_set !== true) throw new Error("Your sign-in details were submitted, but setup wasn't confirmed. Please refresh your account.");
            account = { ...account, login_username: result.login_username || username, credentials_set: true };
            dialog.hidden = true;
            document.body.classList.remove("credential-dialog-open");
            form.reset();
            if (window.VirasatSession) await window.VirasatSession.refresh();
        } catch (failure) {
            if (failure.status === 409 && window.VirasatSession) {
                try {
                    const latest = await window.VirasatSession.refresh();
                    if (latest && latest.credentials_set === true) {
                        account = latest;
                        dialog.hidden = true;
                        document.body.classList.remove("credential-dialog-open");
                        form.reset();
                        return;
                    }
                } catch {}
            }
            setError(failure.message || "We couldn't save your sign-in details. Please try again.");
        } finally {
            saving = false;
            save.disabled = false;
            save.textContent = "Save sign-in details";
        }
    });

    document.addEventListener("virasat:account", event => onAccount(event.detail));
    if (window.VirasatSession) window.VirasatSession.ready.then(onAccount);
    window.VirasatCredentialSetup = { open };
})();
