(function () {
    const auth = window.VirasatAuth;
    const actions = document.querySelector(".site-header .header-actions");
    if (!auth || !actions) return;
    let user = null;
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const $ = id => document.getElementById(id);
    const make = (tag, cls, value) => {
        const element = document.createElement(tag);
        if (cls) element.className = cls;
        if (value !== undefined) element.textContent = String(value);
        return element;
    };
    const nameOf = account => account?.full_name || account?.name || (account?.username?.startsWith("google:") ? account?.email : account?.username) || "Traveler";
    const dateLabel = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Not added";
        const valueDate = new Date(value + "T00:00:00");
        return Number.isNaN(valueDate.getTime()) ? "Not added" : valueDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    };
    const genderLabel = value => ({
        male: "Male", female: "Female", non_binary: "Non-binary",
        other: "Other", prefer_not_to_say: "Prefer not to say"
    })[value] || "Not added";

    const wrapper = make("div", "profile-wrap");
    wrapper.hidden = true;
    const toggle = make("button", "profile-toggle");
    toggle.id = "accountMenuButton";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Open your profile");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c.35-3.6 2.8-5.4 6.5-5.4s6.15 1.8 6.5 5.4"/></svg>';
    const menu = make("section", "profile-popover");
    menu.id = "accountMenu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "Your profile");
    const name = make("strong", "profile-person");
    const menuHeader = make("div", "profile-popover-title");
    menuHeader.append(make("span", "profile-eyebrow", "YOUR VIRASAT"), name);
    const detail = make("dl", "profile-info");
    for (const [label, key] of [["Username", "username"], ["Date of birth", "dob"], ["Gender", "gender"]]) {
        const row = make("div", "profile-info-row");
        row.dataset.profileField = key;
        row.append(make("dt", "", label), make("dd", "", "Not added"));
        detail.appendChild(row);
    }
    const edit = make("button", "profile-manage", "Edit profile ↗");
    edit.type = "button";
    const logout = make("button", "profile-sign-out", "Sign out");
    logout.type = "button";
    menu.append(menuHeader, detail, edit, logout);
    wrapper.append(toggle, menu);
    actions.appendChild(wrapper);

    const modal = make("div", "profile-modal");
    modal.id = "onboardingDialog";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "onboardingTitle");
    modal.innerHTML = [
        '<div class="profile-modal-backdrop"></div>',
        '<div class="profile-modal-content">',
        '<button id="profileClose" class="profile-modal-close" type="button" aria-label="Close profile editor">×</button>',
        '<div class="profile-step">01 / MAKE VIRASAT YOURS</div>',
        '<h2 id="onboardingTitle">A little about you.</h2>',
        '<p class="profile-help">Your name makes the welcome personal. The other details are yours to share.</p>',
        '<form id="profileForm">',
        '<label for="profileFullName">Your name *</label>',
        '<input id="profileFullName" name="full_name" class="field" required maxlength="100" autocomplete="name" placeholder="How should we call you?">',
        '<label for="profileDob">Date of birth <small>optional</small></label>',
        '<input id="profileDob" name="date_of_birth" class="field" type="date">',
        '<label for="profileGender">Gender <small>optional</small></label>',
        '<select id="profileGender" class="field" name="gender">',
        '<option value="prefer_not_to_say">Prefer not to say</option>',
        '<option value="female">Female</option>',
        '<option value="male">Male</option>',
        '<option value="non_binary">Non-binary</option>',
        '<option value="other">Other</option></select>',
        '<p id="profileFormError" class="profile-form-error" role="alert" hidden></p>',
        '<button id="profileSave" class="btn profile-save" type="submit">Save my details ↗</button>',
        '</form><p class="profile-privacy">Your details stay in your account. We don’t display them publicly.</p>',
        '</div>'
    ].join("");
    document.body.appendChild(modal);

    function fillMenu() {
        if (!user) return;
        name.textContent = nameOf(user);
        detail.querySelector('[data-profile-field="username"] dd').textContent = user.username?.startsWith("google:") ? (user.email || "Google account") : (user.username || "Member");
        detail.querySelector('[data-profile-field="dob"] dd').textContent = dateLabel(user.date_of_birth);
        detail.querySelector('[data-profile-field="gender"] dd').textContent = genderLabel(user.gender);
        toggle.title = nameOf(user);
    }
    function showMenu(open) {
        menu.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (open) fillMenu();
    }
    function editor(open) {
        modal.hidden = !open;
        document.body.classList.toggle("profile-editor-open", open);
        if (open) {
            $("profileFullName").value = user?.full_name || user?.name || (user?.username?.startsWith("google:") ? "" : user?.username) || "";
            $("profileDob").value = user?.date_of_birth || "";
            const today = new Date();
            $("profileDob").max = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
            $("profileGender").value = user?.gender || "prefer_not_to_say";
            $("profileFormError").hidden = true;
            $("profileFullName").focus();
        } else toggle.focus();
    }
    toggle.addEventListener("click", () => showMenu(menu.hidden));
    edit.addEventListener("click", () => { showMenu(false); editor(true); });
    $("profileClose").addEventListener("click", () => editor(false));
    modal.querySelector(".profile-modal-backdrop").addEventListener("click", () => editor(false));
    document.addEventListener("click", event => { if (!wrapper.contains(event.target)) showMenu(false); });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (!modal.hidden) editor(false);
            else if (!menu.hidden) { showMenu(false); toggle.focus(); }
        }
    });
    logout.addEventListener("click", async () => {
        logout.disabled = true;
        logout.textContent = "Signing out…";
        try {
            await auth.logout();
            window.location.assign("../landing-page/index.html");
        } catch {
            logout.textContent = "Couldn't sign out. Try again.";
            logout.disabled = false;
        }
    });
    $("profileForm").addEventListener("submit", async event => {
        event.preventDefault();
        const fullName = $("profileFullName").value.trim();
        const dob = $("profileDob").value;
        const gender = $("profileGender").value;
        const error = $("profileFormError");
        error.hidden = true;
        if (fullName.length < 2 || fullName.length > 100) {
            error.textContent = "Please enter a name between 2 and 100 characters.";
            error.hidden = false;
            return;
        }
        const payload = { full_name: fullName, gender };
        if (dob) payload.date_of_birth = dob;
        const save = $("profileSave");
        save.disabled = true;
        save.textContent = "Saving…";
        try {
            user = await auth.updateProfile(payload);
            fillMenu();
            editor(false);
            document.dispatchEvent(new CustomEvent("virasat:account", { detail: user }));
        } catch (failure) {
            error.textContent = failure.status === 404
                ? "Your profile is ready to fill in, but saving needs the new backend update."
                : (failure.message || "We couldn't save your details yet.");
            error.hidden = false;
        } finally {
            save.disabled = false;
            save.textContent = "Save my details ↗";
        }
    });

    function guest() {
        wrapper.hidden = true;
        const login = actions.querySelector("#openAuthBtn, #googleSignInBtn");
        if (login) login.hidden = false;
        if (!login) {
            let link = actions.querySelector("#sessionGuestLink");
            if (!link) {
                link = make("a", "btn btn-ink btn-small", "Sign in ↗");
                link.id = "sessionGuestLink";
                link.href = "../landing-page/index.html?auth=1";
                actions.appendChild(link);
            }
            link.hidden = false;
        }
    }
    function signed(account) {
        user = account;
        wrapper.hidden = false;
        fillMenu();
        for (const id of ["openAuthBtn", "googleSignInBtn", "logoutBtn", "sessionGuestLink"]) {
            const button = actions.querySelector("#" + id);
            if (button) button.hidden = true;
        }
        if (account.onboarding_completed === false) editor(true);
    }
    async function refresh() {
        try {
            const account = await auth.currentUser();
            if (account) signed(account);
            else { user = null; guest(); }
        } catch { user = null; guest(); }
        document.dispatchEvent(new CustomEvent("virasat:account", { detail: user }));
        return user;
    }
    window.VirasatSession = {
        getUser: () => user,
        ready,
        refresh,
        openProfile: () => user && editor(true)
    };
    refresh().then(resolveReady);
})();
