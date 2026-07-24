/* ============================================================
   НЕКТУС — Оптимизированная версия v2.0
   ============================================================ */

// ===== 1. УТИЛИТЫ =====
const Utils = {
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    getInitials(name) {
        if (!name || name.trim() === '') return '?';
        return name.trim().charAt(0).toUpperCase();
    },
    
    formatCountdown(dateStr) {
        if (!dateStr) return 'Скоро';
        const diff = new Date(dateStr) - new Date();
        if (diff <= 0) return 'Открыта! 🎉';
        return `⏳ ${Math.floor(diff / (1000 * 60 * 60 * 24))} дн.`;
    },
    
    formatTime(timestamp) {
        if (!timestamp) return 'только что';
        const diff = Math.floor((new Date() - new Date(timestamp)) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
        return new Date(timestamp).toLocaleDateString('ru-RU');
    }
};

// ===== 2. УВЕДОМЛЕНИЯ (TOAST) =====
const Toast = {
    container: null,
    init() { 
        this.container = document.getElementById('toast-container'); 
    },
    show(message, type = 'info', duration = 3500) {
        const icons = { info: '💡', success: '✨', warning: '️', error: '❌' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${Utils.escapeHtml(message)}</span>`;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ===== 3. МОДАЛЬНЫЕ ОКНА =====
const Modal = {
    overlay: null, 
    content: null,
    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.content = document.getElementById('modal-content');
        document.getElementById('modal-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { 
            if (e.target === this.overlay) this.close(); 
        });
        document.addEventListener('keydown', (e) => { 
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) this.close(); 
        });
    },
    open(html) {
        this.content.innerHTML = html;
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },
    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
};

// ===== 4. ТЁМНАЯ ТЕМА =====
const Theme = {
    init() {
        const isDark = localStorage.getItem('nectus-theme') === 'dark';
        if (isDark) document.body.classList.add('dark-mode');
        
        const toggleBtn = document.getElementById('btn-theme-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
            toggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isNowDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('nectus-theme', isNowDark ? 'dark' : 'light');
                toggleBtn.textContent = isNowDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
            });
        }
    }
};

// ===== 5. АВТОРИЗАЦИЯ =====
const Auth = {
    user: null, 
    profile: null,
    presenceInterval: null,
    
    async init() {
        const supabase = window.supabaseClient;
        const { data: { session } } = await supabase.auth.getSession();
        this.user = session?.user || null;
        
        if (this.user) {
            await this.loadProfile();
            Profile.syncWithAuth();
            if (window.location.hash === '#circle') await Renderer.renderCircle();
        }
        
        supabase.auth.onAuthStateChange(async (event, session) => {
            this.user = session?.user || null;
            if (event === 'SIGNED_IN') {
                await this.loadProfile();
                Profile.syncWithAuth();
                this.showUserProfile();
                this.startPresenceTracking();
                if (window.location.hash === '#circle') await Renderer.renderCircle();
            } else if (event === 'SIGNED_OUT') {
                this.profile = null;
                Profile.clear();
                this.showUserProfile();
            }
        });
        
        document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
        this.showUserProfile();
    },
    
    showLoginModal() {
        Modal.open(`
            <h3>🔐 Вход в Нектус</h3>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button class="btn btn-primary" id="tab-login" style="flex: 1;">Войти</button>
                <button class="btn btn-soft" id="tab-register" style="flex: 1;">Регистрация</button>
            </div>
            <form id="auth-form">
                <div class="field-group"><label>Email</label><input type="email" id="auth-email" required placeholder="your@email.com"></div>
                <div class="field-group"><label>Пароль</label><input type="password" id="auth-password" required placeholder="Минимум 6 символов" minlength="6"></div>
                <div id="register-fields" style="display: none;">
                    <div class="field-group"><label>Username</label><input type="text" id="auth-username" placeholder="@username" pattern="[a-zA-Z0-9_]{3,20}"><small style="color: var(--text-muted); font-size: 0.8em;">3-20 символов, буквы, цифры, _</small></div>
                    <div class="field-group"><label>Имя</label><input type="text" id="auth-name" placeholder="Как вас зовут?"></div>
                    <div class="field-group"><label>Возраст</label><input type="number" id="auth-age" min="1" max="120" placeholder="Сколько вам лет?"></div>
                </div>
                <div id="auth-error" style="color: var(--pink-500); display: none; margin-bottom: 10px;"></div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;" id="auth-submit-btn">Войти</button>
            </form>
        `);

        let mode = 'login';
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const registerFields = document.getElementById('register-fields');
        const submitBtn = document.getElementById('auth-submit-btn');

        tabLogin.addEventListener('click', () => {
            mode = 'login'; 
            tabLogin.className = 'btn btn-primary'; 
            tabRegister.className = 'btn btn-soft';
            registerFields.style.display = 'none'; 
            submitBtn.textContent = 'Войти';
        });
        
        tabRegister.addEventListener('click', () => {
            mode = 'register'; 
            tabRegister.className = 'btn btn-primary'; 
            tabLogin.className = 'btn btn-soft';
            registerFields.style.display = 'block'; 
            submitBtn.textContent = 'Зарегистрироваться';
        });

        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const username = document.getElementById('auth-username')?.value.trim();
            const name = document.getElementById('auth-name')?.value.trim();
            const age = parseInt(document.getElementById('auth-age')?.value);
            const errorEl = document.getElementById('auth-error');
            errorEl.style.display = 'none';

            if (mode === 'register') {
                if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
                    errorEl.textContent = 'Username: 3-20 символов (a-z, A-Z, 0-9, _)'; 
                    errorEl.style.display = 'block'; 
                    return;
                }
                if (!name || name.length < 2) { 
                    errorEl.textContent = 'Введите имя'; 
                    errorEl.style.display = 'block'; 
                    return; 
                }
                if (!age || age < 1 || age > 120) { 
                    errorEl.textContent = 'Введите корректный возраст'; 
                    errorEl.style.display = 'block'; 
                    return; 
                }
            }

            submitBtn.disabled = true; 
            submitBtn.textContent = 'Загрузка...';
            const supabase = window.supabaseClient;

            try {
                if (mode === 'login') {
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    Modal.close(); 
                    Toast.show('Добро пожаловать! ✨', 'success');
                } else {
                    const { data: existingUser } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle();
                    if (existingUser) throw new Error('Username уже занят');

                    const { data: authData, error: authError } = await supabase.auth.signUp({
                        email, password, options: { data: { name, username } }
                    });
                    if (authError) throw authError;

                    const { error: profileError } = await supabase.from('profiles').update({
                        username, display_name: name, name, age, last_username_change: new Date().toISOString()
                    }).eq('id', authData.user.id);
                    if (profileError) throw profileError;

                    Modal.close(); 
                    Toast.show('Регистрация успешна! Теперь войдите. ✨', 'success');
                }
            } catch (error) {
                errorEl.textContent = error.message; 
                errorEl.style.display = 'block';
                submitBtn.disabled = false; 
                submitBtn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
            }
        });
    },

    async loadProfile() {
        if (!this.user) return null;
        const supabase = window.supabaseClient;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
        if (error) return null;
        
        this.profile = data || {};
        Profile.data = {
            name: data?.name || this.user.email?.split('@')[0] || 'Гость',
            age: data?.age || 18, 
            bio: data?.bio || '', 
            photo_url: data?.photo_url,
            username: data?.username || null, 
            status: data?.status || '', 
            last_username_change: data?.last_username_change
        };
        Profile.render();
        return this.profile;
    },

    showUserProfile() {
        const profileMini = document.getElementById('user-profile-mini');
        const photoEl = document.getElementById('user-photo');
        const nameEl = document.getElementById('user-display-name');
        const loginBtn = document.getElementById('btn-show-login');
        
        if (this.user) {
            const userData = this.getUser();
            if (profileMini) profileMini.style.display = 'flex';
            if (loginBtn) loginBtn.style.display = 'none';
            if (photoEl) {
                if (this.profile?.photo_url) { 
                    photoEl.src = this.profile.photo_url; 
                    photoEl.style.display = 'block'; 
                } else { 
                    photoEl.style.display = 'none'; 
                }
            }
            if (nameEl) nameEl.textContent = userData.username ? `@${userData.username}` : userData.name;
        } else {
            if (profileMini) profileMini.style.display = 'none';
            if (loginBtn) {
                loginBtn.style.display = 'inline-flex';
                loginBtn.onclick = () => this.showLoginModal();
            }
        }
    },

    async logout() {
        await window.supabaseClient.auth.signOut();
        this.user = null; 
        this.profile = null;
        Profile.clear(); 
        this.showUserProfile();
        if (typeof Notifications !== 'undefined') Notifications.cleanup();
        Toast.show('Вы вышли из аккаунта', 'info');
        window.location.hash = '#home';
    },

    requireAuth() {
        if (!this.user) { 
            Toast.show('Войдите, чтобы выполнить это действие', 'warning'); 
            this.showLoginModal(); 
            return false; 
        }
        return true;
    },

    getUser() {
        if (!this.user) return { id: undefined, name: 'Аноним', username: null, age: 18, photo: null, email: '' };
        return {
            id: this.user.id, 
            name: this.profile?.name || this.user?.email?.split('@')[0] || 'Аноним',
            username: this.profile?.username || null, 
            age: this.profile?.age || 18,
            photo: this.profile?.photo_url || null, 
            email: this.user?.email || ''
        };
    },

    updateLastSeen() {
        if (!this.user) return;
        window.supabaseClient
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', this.user.id)
        .then(() => console.log('✅ last_seen обновлён'))
        .catch(err => console.error('❌ Ошибка обновления last_seen:', err));
    },

    startPresenceTracking() {
        this.updateLastSeen();
        this.presenceInterval = setInterval(() => this.updateLastSeen(), 30000);
        
        ['click', 'keydown', 'scroll'].forEach(event => {
            document.addEventListener(event, () => this.updateLastSeen(), { passive: true });
        });
        
        window.addEventListener('beforeunload', () => {
            if (this.presenceInterval) clearInterval(this.presenceInterval);
        });
    }
};

// ===== 6. РАБОТА С БАЗОЙ ДАННЫХ =====
const Database = {
    get client() { return window.supabaseClient; },
    cache: {}, 
    cacheTime: {},
    
    getCached(key, maxAge = 300000) {
        const cached = this.cache[key], cachedTime = this.cacheTime[key];
        if (cached && cachedTime && (Date.now() - cachedTime < maxAge)) return cached;
        return null;
    },
    
    setCache(key, data) { 
        this.cache[key] = data; 
        this.cacheTime[key] = Date.now(); 
    },
    
    async getStories(topic = null) {
        const cacheKey = `stories_${topic || 'all'}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        let query = this.client.from('stories').select('*').order('created_at', { ascending: false });
        if (topic) query = query.eq('topic', topic);
        
        const { data, error } = await query;
        if (error) return [];
        
        this.setCache(cacheKey, data || []);
        return data || [];
    },

    async getComments(storyId) {
        const { data, error } = await this.client.from('comments').select('*').eq('story_id', storyId).order('created_at', { ascending: true });
        return error ? [] : (data || []);
    },

    async addComment(commentData) {
        const { data, error } = await this.client.from('comments').insert(commentData).select().single();
        return error ? null : data;
    },

    async getExchanges() {
        const { data, error } = await this.client.from('exchanges').select('*').order('created_at', { ascending: false });
        return error ? [] : (data || []);
    },

    async addExchange(exchangeData) {
        const { data, error } = await this.client.from('exchanges').insert(exchangeData).select().single();
        return error ? null : data;
    },

    async getCapsules() {
        const { data, error } = await this.client.from('capsules').select('*').order('open_date', { ascending: true });
        return error ? [] : (data || []);
    },

    async addCapsule(capsuleData) {
        const { data, error } = await this.client.from('capsules').insert(capsuleData).select().single();
        return error ? null : data;
    },

    async sendPrivateMessage(receiverId, text) {
        const user = Auth.getUser();
        if (!user || !user.id) { 
            Toast.show('Ошибка: вы не авторизованы', 'error'); 
            return null; 
        }
        if (user.id === receiverId) { 
            Toast.show('Нельзя отправить сообщение самому себе! 😅', 'warning'); 
            return null; 
        }
        if (!text || !text.trim()) { 
            Toast.show('Введите текст сообщения', 'warning'); 
            return null; 
        }
        
        const { data, error } = await this.client.from('private_messages').insert({
            sender_id: user.id, 
            receiver_id: receiverId, 
            text: text.trim()
        }).select().single();
        
        if (error) { 
            Toast.show('Ошибка при отправке сообщения', 'error'); 
            return null; 
        }
        return data;
    },

    async getPrivateMessages(otherUserId) {
        const user = Auth.getUser();
        if (!user || !user.id) return [];
        
        const { data: allMessages, error } = await this.client.from('private_messages')
            .select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: true });
        
        if (error) return [];
        
        return allMessages.filter(msg => 
            (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id)
        ) || [];
    },

    async sendCircleInvitation(receiverUsername) {
        const user = Auth.getUser();
        if (!user || !user.id) return null;
        
        const username = receiverUsername.trim().replace('@', '');
        if (!username) { 
            Toast.show('Введите username', 'warning'); 
            return null; 
        }
        if (user.username && user.username.toLowerCase() === username.toLowerCase()) {
            Toast.show('Нельзя пригласить самого себя! 😅', 'warning'); 
            return null; 
        }
        
        const { data: targetProfile, error: searchError } = await this.client.from('profiles')
            .select('id, username, name, email').ilike('username', username).maybeSingle();
        
        if (searchError || !targetProfile) { 
            Toast.show(`Пользователь @${username} не найден`, 'error'); 
            return null; 
        }
        if (targetProfile.id === user.id) { 
            Toast.show('Нельзя пригласить самого себя!', 'warning'); 
            return null; 
        }
        
        const { data: existing } = await this.client.from('circle_invitations').select('id')
            .eq('sender_id', user.id).eq('receiver_id', targetProfile.id).eq('status', 'pending').maybeSingle();
        
        if (existing) { 
            Toast.show('Приглашение уже отправлено!', 'warning'); 
            return existing; 
        }
        
        const { data, error } = await this.client.from('circle_invitations').insert({
            sender_id: user.id, 
            receiver_id: targetProfile.id, 
            receiver_email: targetProfile.email, 
            status: 'pending'
        }).select().single();
        
        if (error) { 
            Toast.show('Ошибка при отправке приглашения', 'error'); 
            return null; 
        }
        
        Toast.show(`Приглашение отправлено @${targetProfile.username}! ✨`, 'success');
        return data;
    },

    async getMyInvitations() {
        const user = Auth.getUser();
        if (!user || !user.id) return [];
        
        const { data, error } = await this.client.from('circle_invitations').select('*')
            .eq('sender_id', user.id).eq('status', 'pending').order('created_at', { ascending: false });
        
        return error ? [] : (data || []);
    },

    async getIncomingInvitations() {
        const user = Auth.getUser();
        if (!user || !user.id) return [];
        
        const userEmail = user.email;
        if (!userEmail) return [];
        
        const { data, error } = await this.client.from('circle_invitations').select('*')
            .eq('status', 'pending').eq('receiver_email', userEmail).order('created_at', { ascending: false });
        
        return error ? [] : (data || []);
    },

    async respondToInvitation(invitationId, accept) {
        const user = Auth.getUser();
        if (!user || !user.id) return null;
        
        const status = accept ? 'accepted' : 'rejected';
        
        const { data: invitation, error: fetchError } = await this.client.from('circle_invitations')
            .select('sender_id, receiver_id, receiver_email').eq('id', invitationId).single();
        
        if (fetchError || !invitation) return null;
        
        const { data, error } = await this.client.from('circle_invitations').update({ 
            status: status, 
            responded_at: new Date().toISOString()
        }).eq('id', invitationId).select().single();
        
        if (error) return null;
        if (accept && data) await this.createCircleConnection(invitation.sender_id, user.id);
        return data;
    },

    async createCircleConnection(user1Id, user2Id) {
        const { error } = await this.client.from('circle_connections').insert({ user1_id: user1Id, user2_id: user2Id });
        return !error;
    },

    async getCircleMembers() {
        const user = Auth.getUser();
        if (!user || !user.id) return [];
        
        const { data: connections, error } = await this.client.from('circle_connections')
            .select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
        
        if (error) return [];
        
        const otherUserIds = connections.map(conn => conn.user1_id === user.id ? conn.user2_id : conn.user1_id);
        if (otherUserIds.length === 0) return [];
        
        const { data: profiles, error: profilesError } = await this.client.from('profiles').select('*').in('id', otherUserIds);
        return profilesError ? [] : (profiles || []);
    }
};

// ===== 7. СОСТОЯНИЕ =====
const State = {
    currentPage: 'home', 
    currentTopic: null, 
    currentStory: null, 
    previousPage: 'home',
    viewedStories: parseInt(sessionStorage.getItem('bridge_viewed') || '0'),
    silentLimit: parseInt(localStorage.getItem('bridge_silent_limit') || '5'),
    stories: [], 
    exchanges: [], 
    capsules: [],
    exchangesLoaded: false, 
    capsulesLoaded: false, 
    circleLoaded: false
};

// ===== 8. ПРОФИЛЬ =====
const Profile = {
    data: { name: 'Гость', age: 18, bio: '', photo: null },
    
    init() {
        this.render();
        document.getElementById('btn-edit-profile')?.addEventListener('click', () => this.openEditModal());
    },
    
    clear() { 
        this.data = { name: 'Гость', age: 18, bio: '', photo: null }; 
        this.render(); 
    },
    
    syncWithAuth() {
        if (Auth.user && Auth.profile) {
            this.data = {
                name: Auth.profile.name || Auth.user.email?.split('@')[0] || 'Гость',
                age: Auth.profile.age || 18, 
                bio: Auth.profile.bio || '', 
                photo_url: Auth.profile.photo_url,
                username: Auth.profile.username || null, 
                status: Auth.profile.status || '', 
                last_username_change: Auth.profile.last_username_change
            };
            this.render();
        }
    },
    
    update(userData) { 
        this.data = { ...this.data, ...userData }; 
        this.render(); 
    },
    
    render() {
        const nameEl = document.getElementById('profile-name');
        const statusEl = document.getElementById('profile-status');
        const bioEl = document.getElementById('profile-bio');
        const avatarLetterEl = document.getElementById('profile-avatar-letter');
        const avatarImg = document.getElementById('profile-avatar-img');
        const data = this.data;
        
        if (nameEl) {
            let html = `<div style="display: flex; flex-direction: column; line-height: 1.2;">`;
            html += `<div style="font-size: 1.5em; font-weight: 700; color: white;">${Utils.escapeHtml(data.name)}</div>`;
            if (data.username) html += `<div style="font-size: 0.9em; color: rgba(255,255,255,0.85); margin-top: 2px;">@${Utils.escapeHtml(data.username)}</div>`;
            html += `<div style="font-size: 0.95em; color: rgba(255,255,255,0.9); margin-top: 4px;">${data.age || 18} лет</div></div>`;
            nameEl.innerHTML = html;
        }
        
        if (statusEl) statusEl.textContent = data.status || '️ Строитель Мостов';
        if (bioEl) bioEl.textContent = data.bio || 'Расскажите о себе...';
        
        if (avatarLetterEl) {
            avatarLetterEl.textContent = Utils.getInitials(data.name);
            avatarLetterEl.style.display = data.photo_url ? 'none' : 'flex';
        }
        
        if (avatarImg) {
            if (data.photo_url) { 
                avatarImg.src = data.photo_url; 
                avatarImg.style.display = 'block'; 
                avatarLetterEl.style.display = 'none'; 
            } else { 
                avatarImg.style.display = 'none'; 
                if (avatarLetterEl) avatarLetterEl.style.display = 'flex'; 
            }
        }
        
        Auth.showUserProfile();
    },

    openEditModal() {
        const currentData = Auth.profile || this.data;
        const user = Auth.user;
        
        let usernameChangeInfo = '';
        if (currentData.last_username_change) {
            const daysDiff = Math.floor((new Date() - new Date(currentData.last_username_change)) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 14 - daysDiff);
            usernameChangeInfo = daysLeft > 0 
                ? `<small style="color: var(--amber-500); font-size: 0.8em;"> Можно изменить через ${daysLeft} дн.</small>`
                : `<small style="color: var(--emerald-500); font-size: 0.8em;">✅ Можно изменить</small>`;
        } else {
            usernameChangeInfo = `<small style="color: var(--emerald-500); font-size: 0.8em;">✅ Можно изменить</small>`;
        }
        
        Modal.open(`
            <h3>✏️ Редактировать профиль</h3>
            <form id="profile-edit-form">
                <div class="avatar-upload-section" style="text-align: center; margin-bottom: 20px; padding: 20px; background: var(--surface); border-radius: var(--radius-lg);">
                    <div style="width: 100px; height: 100px; margin: 0 auto 10px; border-radius: 50%; overflow: hidden; background: var(--gradient-primary);">
                        <img id="edit-avatar-preview" src="${currentData.photo_url || ''}" style="width: 100%; height: 100%; object-fit: cover; display: ${currentData.photo_url ? 'block' : 'none'};">
                        <div id="edit-avatar-placeholder" style="width: 100%; height: 100%; display: ${!currentData.photo_url ? 'flex' : 'none'}; align-items: center; justify-content: center; font-size: 2.5em; color: white;">${Utils.getInitials(currentData.name)}</div>
                    </div>
                    <label for="edit-avatar-input" class="btn btn-soft" style="cursor: pointer; display: inline-block; margin-top: 10px;">${currentData.photo_url ? 'Изменить фото' : 'Загрузить фото'}</label>
                    <input type="file" id="edit-avatar-input" accept="image/*" style="display: none;">
                    ${currentData.photo_url ? '<br><button type="button" id="btn-remove-avatar" class="btn btn-ghost" style="margin-top: 10px; font-size: 0.85em;"> Удалить фото</button>' : ''}
                </div>
                <div class="field-group"><label>Username</label><input type="text" id="edit-username" value="${Utils.escapeHtml((currentData.username || '').replace('@', ''))}" placeholder="username" pattern="[a-zA-Z0-9_]{3,20}">${usernameChangeInfo}</div>
                <div class="field-group"><label>Имя</label><input type="text" id="edit-name" value="${Utils.escapeHtml(currentData.name)}" required></div>
                <div class="field-group"><label>Возраст</label><input type="number" id="edit-age" value="${currentData.age || 18}" min="1" max="120" required></div>
                <div class="field-group"><label>О себе</label><textarea id="edit-bio" rows="3" maxlength="200">${Utils.escapeHtml(currentData.bio || '')}</textarea></div>
                <div id="edit-error" style="color: var(--pink-500); display: none; margin-bottom: 10px;"></div>
                <button type="submit" class="btn btn-gradient" style="width: 100%; margin-top: 10px;">💾 Сохранить</button>
            </form>
        `);

        document.getElementById('edit-username')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/@/g, '').replace(/[^a-zA-Z0-9_]/g, '');
        });

        const avatarInput = document.getElementById('edit-avatar-input');
        const avatarPreview = document.getElementById('edit-avatar-preview');
        const avatarPlaceholder = document.getElementById('edit-avatar-placeholder');
        let uploadedFile = null;

        avatarInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                document.getElementById('edit-error').textContent = 'Файл слишком большой (макс. 5MB)';
                document.getElementById('edit-error').style.display = 'block'; 
                return;
            }
            uploadedFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                avatarPreview.src = event.target.result; 
                avatarPreview.style.display = 'block';
                avatarPlaceholder.style.display = 'none'; 
                document.getElementById('edit-error').style.display = 'none';
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('btn-remove-avatar')?.addEventListener('click', async () => {
            if (!confirm('Удалить фото профиля?')) return;
            const userId = Auth.user?.id;
            await window.supabaseClient.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
            await window.supabaseClient.from('profiles').update({ photo_url: null }).eq('id', userId);
            Auth.profile.photo_url = null; 
            location.reload();
        });

        document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('edit-error');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true; 
            submitBtn.textContent = 'Сохранение...';
            
            const newUsername = document.getElementById('edit-username').value.trim().replace('@', '');
            const updatedData = {
                name: document.getElementById('edit-name').value.trim(),
                age: parseInt(document.getElementById('edit-age').value),
                bio: document.getElementById('edit-bio').value.trim()
            };

            if (!updatedData.name) {
                errorEl.textContent = 'Имя не может быть пустым'; 
                errorEl.style.display = 'block';
                submitBtn.disabled = false; 
                submitBtn.textContent = '💾 Сохранить'; 
                return;
            }

            if (newUsername && newUsername !== currentData.username) {
                if (newUsername.length < 3 || newUsername.length > 20 || !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
                    errorEl.textContent = 'Username: 3-20 символов (a-z, A-Z, 0-9, _)'; 
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false; 
                    submitBtn.textContent = '💾 Сохранить'; 
                    return;
                }
                if (currentData.last_username_change) {
                    const daysDiff = Math.floor((new Date() - new Date(currentData.last_username_change)) / (1000 * 60 * 60 * 24));
                    if (daysDiff < 14) {
                        errorEl.textContent = `Можно менять раз в 14 дней. Осталось: ${14 - daysDiff} дн.`; 
                        errorEl.style.display = 'block';
                        submitBtn.disabled = false; 
                        submitBtn.textContent = '💾 Сохранить'; 
                        return;
                    }
                }
                const { data: existing } = await window.supabaseClient.from('profiles').select('username').eq('username', newUsername).neq('id', user.id).maybeSingle();
                if (existing) {
                    errorEl.textContent = 'Этот username уже занят'; 
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false; 
                    submitBtn.textContent = '💾 Сохранить'; 
                    return;
                }
                updatedData.username = newUsername;
                updatedData.last_username_change = new Date().toISOString();
            }

            if (uploadedFile) {
                submitBtn.textContent = 'Загрузка фото...';
                const userId = Auth.user?.id;
                const { error: uploadError } = await window.supabaseClient.storage.from('avatars').upload(`${userId}/avatar.jpg`, uploadedFile, { upsert: true });
                if (uploadError) {
                    errorEl.textContent = 'Не удалось загрузить фото'; 
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false; 
                    submitBtn.textContent = '💾 Сохранить'; 
                    return;
                }
                const { data: urlData } = window.supabaseClient.storage.from('avatars').getPublicUrl(`${userId}/avatar.jpg`);
                updatedData.photo_url = urlData.publicUrl;
            }

            submitBtn.textContent = 'Сохранение профиля...';
            const { data, error } = await window.supabaseClient.from('profiles').update(updatedData).eq('id', Auth.user?.id).select().single();
            
            if (error) {
                errorEl.textContent = 'Не удалось сохранить'; 
                errorEl.style.display = 'block';
                submitBtn.disabled = false; 
                submitBtn.textContent = '💾 Сохранить'; 
                return;
            }

            Auth.profile = data;
            this.data = { ...this.data, ...updatedData };
            this.render(); 
            Auth.showUserProfile();
            Modal.close(); 
            Toast.show('Профиль обновлён! ✨', 'success');
        });
    },
    
    get() { 
        return this.data; 
    }
};

// ===== 9. ЧАТ =====
const Chat = {
    drafts: new Map(),
    currentChatId: null,
    statusInterval: null,
    pendingChatUser: null,
    
    init() {
        const chatForm = document.getElementById('chat-page-form');
        const chatInput = document.getElementById('chat-page-input');
        
        if (chatInput) {
            chatInput.addEventListener('input', (e) => {
                if (this.currentChatId) {
                    this.drafts.set(this.currentChatId, e.target.value);
                }
            });
        }
        
        if (chatForm && chatInput) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text || !this.currentChatId) return;
                
                const result = await Database.sendPrivateMessage(this.currentChatId, text);
                if (result) {
                    chatInput.value = '';
                    this.drafts.delete(this.currentChatId);
                    await Renderer.renderChat(this.currentChatId);
                }
            });
        }
    },
    
    open(userId, userName, userPhoto) {
        this.pendingChatUser = { id: userId, name: userName, photo: userPhoto };
        window.location.hash = `chat/${userId}`;
    },
    
    async loadPage(userId) {
        document.body.classList.add('chat-open');
        this.currentChatId = userId;
        
        if (this.statusInterval) clearInterval(this.statusInterval);
        
        const supabase = window.supabaseClient;
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('name, username, photo_url, last_seen')
            .eq('id', userId)
            .single();
        
        const avatarPlaceholder = document.getElementById('chat-page-avatar-placeholder');
        const avatarImg = document.getElementById('chat-page-avatar');
        const nameEl = document.getElementById('chat-page-name');
        const statusEl = document.getElementById('chat-page-status');
        
        if (avatarPlaceholder && avatarImg && nameEl) {
            const displayName = userProfile?.name || this.pendingChatUser?.name || 'Пользователь';
            const displayPhoto = userProfile?.photo_url || this.pendingChatUser?.photo;
            const username = userProfile?.username;
            
            if (displayPhoto) {
                avatarImg.src = displayPhoto; 
                avatarImg.style.display = 'block'; 
                avatarPlaceholder.style.display = 'none';
            } else {
                avatarPlaceholder.textContent = Utils.getInitials(displayName); 
                avatarPlaceholder.style.display = 'flex'; 
                avatarImg.style.display = 'none';
            }
            
            nameEl.innerHTML = username 
                ? `${Utils.escapeHtml(displayName)}<span style="color: var(--text-muted); font-weight: 400; font-size: 0.9em; margin-left: 5px;">@${Utils.escapeHtml(username)}</span>` 
                : Utils.escapeHtml(displayName);
            
            if (statusEl) {
                const updateStatusUI = (lastSeen) => {
                    if (!lastSeen) {
                        statusEl.textContent = 'оффлайн';
                        statusEl.style.color = '#9CA3AF';
                    } else {
                        const diffMs = new Date() - new Date(lastSeen);
                        const diffSeconds = Math.floor(diffMs / 1000);
                        if (diffSeconds < 10) {
                            statusEl.textContent = '🟢 онлайн';
                            statusEl.style.color = '#10B981';
                        } else if (diffSeconds < 60) {
                            statusEl.textContent = `был(а) ${diffSeconds} сек. назад`;
                            statusEl.style.color = '#9CA3AF';
                        } else {
                            const minutes = Math.floor(diffSeconds / 60);
                            if (minutes < 60) {
                                statusEl.textContent = `был(а) ${minutes} мин. назад`;
                            } else {
                                const hours = Math.floor(minutes / 60);
                                statusEl.textContent = `был(а) ${hours} ч. назад`;
                            }
                            statusEl.style.color = '#9CA3AF';
                        }
                    }
                };
                
                updateStatusUI(userProfile?.last_seen);
                
                this.statusInterval = setInterval(async () => {
                    const { data } = await supabase.from('profiles').select('last_seen').eq('id', userId).single();
                    if (data) updateStatusUI(data.last_seen);
                }, 5000);
            }
        }
        
        await Renderer.renderChat(userId);
        
        const chatInput = document.getElementById('chat-page-input');
        if (chatInput) {
            chatInput.value = this.drafts.get(userId) || '';
        }
        
        this.pendingChatUser = null;
    }
};

// ===== 10. КАПСУЛЫ ВРЕМЕНИ =====
const Capsules = {
    timerInterval: null,
    
    startTimers() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            document.querySelectorAll('.capsule-timer').forEach(el => {
                const openDate = new Date(el.dataset.openDate);
                const diff = openDate - new Date();
                
                if (diff <= 0) {
                    el.textContent = '🎉 Открыта!';
                    const card = el.closest('.capsule-card');
                    if (card && !card.classList.contains('opened')) {
                        card.classList.add('opened');
                        card.querySelector('.capsule-icon').textContent = '🎉';
                        card.querySelector('.capsule-status span:last-child').textContent = 'Можно открыть!';
                        card.querySelector('.capsule-status .dot').style.background = '#10B981';
                    }
                } else {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    el.textContent = `${days}д ${hours}ч ${minutes}м ${seconds}с`;
                }
            });
        }, 1000);
    },
    
    stopTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },
    
    showCreateModal() {
        if (!Auth.requireAuth()) return;
        
        Modal.open(`
            <h3> Создать капсулу времени</h3>
            <form class="capsule-form" id="capsule-create-form">
                <div class="field-group">
                    <label>📝 Название капсулы</label>
                    <input type="text" id="capsule-title" required placeholder="Например: Письмо себе в 2030" maxlength="100">
                </div>
                <div class="field-group">
                    <label> Дата открытия</label>
                    <input type="date" id="capsule-date" required>
                    <div class="hint">Минимум — завтра. Максимум — 50 лет вперёд.</div>
                </div>
                <div class="field-group">
                    <label> Группа</label>
                    <select id="capsule-group">
                        <option value="Личная">🔒 Личная (только я)</option>
                        <option value="Семья">👨‍‍👧‍👦 Семья</option>
                        <option value="Друзья">👫 Друзья</option>
                        <option value="Коллеги">💼 Коллеги</option>
                        <option value="Наш двор">🏘️ Наш двор</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>✍️ Содержимое капсулы</label>
                    <textarea id="capsule-content" required placeholder="Напишите письмо, поделитесь мечтами, задайте вопросы себе будущему..." maxlength="5000"></textarea>
                    <div class="hint">Это содержимое будет недоступно до даты открытия</div>
                </div>
                <div id="capsule-error" style="color: var(--pink-500); display: none; margin-bottom: 10px;"></div>
                <button type="submit" class="btn btn-gradient" style="width: 100%; margin-top: 10px;">🔒 Запечатать капсулу</button>
            </form>
        `);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('capsule-date').min = tomorrow.toISOString().split('T')[0];
        
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 50);
        document.getElementById('capsule-date').max = maxDate.toISOString().split('T')[0];
        
        document.getElementById('capsule-create-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('capsule-error');
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            const title = document.getElementById('capsule-title').value.trim();
            const date = document.getElementById('capsule-date').value;
            const group = document.getElementById('capsule-group').value;
            const content = document.getElementById('capsule-content').value.trim();
            
            if (!title || !date || !content) {
                errorEl.textContent = 'Заполните все поля';
                errorEl.style.display = 'block';
                return;
            }
            
            const selectedDate = new Date(date);
            const now = new Date();
            if (selectedDate <= now) {
                errorEl.textContent = 'Дата открытия должна быть в будущем';
                errorEl.style.display = 'block';
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = '🔒 Запечатываем...';
            
            const user = Auth.getUser();
            const { data, error } = await Database.client
                .from('capsules')
                .insert({
                    title,
                    group_name: group,
                    creator_id: user.id,
                    open_date: date,
                    content,
                    is_opened: false
                })
                .select()
                .single();
            
            if (error) {
                errorEl.textContent = 'Ошибка при создании: ' + error.message;
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '🔒 Запечатать капсулу';
                return;
            }
            
            Modal.close();
            Toast.show('Капсула запечатана! 🕰️ Она откроется ' + new Date(date).toLocaleDateString('ru-RU'), 'success', 5000);
            await Renderer.renderCapsules();
        });
    },
    
    async open(capsuleId) {
        const capsule = State.capsules.find(c => c.id === capsuleId);
        if (!capsule) return;
        
        const openDate = new Date(capsule.open_date);
        const now = new Date();
        const canOpen = openDate <= now;
        
        if (!canOpen) {
            const days = Math.ceil((openDate - now) / (1000 * 60 * 60 * 24));
            Modal.open(`
                <div class="capsule-open-modal">
                    <div class="big-icon">🔒</div>
                    <h2>${Utils.escapeHtml(capsule.title)}</h2>
                    <p class="capsule-date">Откроется через <strong>${days}</strong> дн. — ${openDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <div class="capsule-content" style="filter: blur(5px); user-select: none; opacity: 0.5;">
                        Содержимое капсулы пока недоступно. Оно будет раскрыто в назначенную дату.
                    </div>
                    <div class="capsule-meta">
                        <div class="meta-item">
                            <span class="label">Группа</span>
                            <span class="value">${Utils.escapeHtml(capsule.group_name || 'Личная')}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">Создана</span>
                            <span class="value">${new Date(capsule.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9em;">🔒 Капсула запечатана и ждёт своего часа</p>
                </div>
            `);
            return;
        }
        
        if (!capsule.is_opened) {
            await Database.client
                .from('capsules')
                .update({ is_opened: true })
                .eq('id', capsuleId);
            capsule.is_opened = true;
        }
        
        Modal.open(`
            <div class="capsule-open-modal">
                <div class="big-icon">🎉</div>
                <h2>${Utils.escapeHtml(capsule.title)}</h2>
                <p class="capsule-date">✨ Капсула открыта! ${openDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <div class="capsule-meta">
                    <div class="meta-item">
                        <span class="label">Группа</span>
                        <span class="value">${Utils.escapeHtml(capsule.group_name || 'Личная')}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Запечатана</span>
                        <span class="value">${new Date(capsule.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                <div class="capsule-content">${Utils.escapeHtml(capsule.content || 'Содержимое пусто')}</div>
                <button class="btn btn-primary" onclick="Modal.close()" style="margin-top: 10px;">✨ Закрыть</button>
            </div>
        `);
    }
};

// ===== 11. ПРИГЛАШЕНИЯ =====
const CircleInvitations = {
    init() {
        document.getElementById('btn-invite-circle')?.addEventListener('click', () => this.showInviteModal());
        document.getElementById('btn-show-invitations')?.addEventListener('click', () => this.showIncomingInvitations());
        setTimeout(() => this.checkIncomingInvitations(), 1000);
    },
    
    showInviteModal() {
        if (!Auth.requireAuth()) return;
        
        Modal.open(`
            <h3>✨ Пригласить в круг</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Введите username пользователя (например: @ivan)</p>
            <form id="invite-form">
                <div class="field-group"><label>Username</label><input type="text" id="invite-username" required placeholder="@username" pattern="[a-zA-Z0-9_]{3,20}"></div>
                <div id="invite-error" style="color: var(--pink-500); display: none; margin-bottom: 10px;"></div>
                <button type="submit" class="btn btn-primary" style="width: 100%;"> Отправить</button>
            </form>
        `);
        
        this.loadSentInvitations();
        document.getElementById('invite-form').addEventListener('submit', async (e) => {
            e.preventDefault(); 
            await this.sendInvitation();
        });
    },
    
    async checkIncomingInvitations() {
        const user = Auth.getUser();
        if (!user || !user.id) return;
        
        const invitations = await Database.getIncomingInvitations();
        const countEl = document.getElementById('invitations-count');
        
        if (countEl) {
            countEl.textContent = invitations.length;
            if (invitations.length > 0) Toast.show(`У вас ${invitations.length} новое приглашение! 📬`, 'info', 5000);
        }
    },
    
    async sendInvitation() {
        const username = document.getElementById('invite-username').value.trim();
        const errorEl = document.getElementById('invite-error');
        const submitBtn = document.querySelector('#invite-form button[type="submit"]');
        
        if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            errorEl.textContent = 'Username: 3-20 символов (a-z, A-Z, 0-9, _)'; 
            errorEl.style.display = 'block'; 
            return;
        }
        
        submitBtn.disabled = true; 
        submitBtn.textContent = 'Отправка...'; 
        errorEl.style.display = 'none';
        
        const result = await Database.sendCircleInvitation(username);
        
        if (result) { 
            Modal.close(); 
            this.loadSentInvitations(); 
        } else {
            errorEl.textContent = 'Не удалось отправить'; 
            errorEl.style.display = 'block';
            submitBtn.disabled = false; 
            submitBtn.textContent = '📨 Отправить';
        }
    },
    
    async loadSentInvitations() {
        const invitations = await Database.getMyInvitations();
        const list = document.getElementById('invitations-list');
        
        if (!list) return;
        
        list.innerHTML = invitations.length === 0 
            ? '<p style="color: var(--text-muted); text-align: center; padding: 10px;">Нет активных приглашений</p>'
            : invitations.map(inv => `<div style="padding: 10px; background: var(--surface); border-radius: var(--radius-md); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><span>${Utils.escapeHtml(inv.receiver_email)}</span><span class="badge badge-soft" style="font-size: 0.8em;">⏳ Ожидает</span></div>`).join('');
    },
    
    async showIncomingInvitations() {
        const invitations = await Database.getIncomingInvitations();
        
        if (invitations.length === 0) {
            Modal.open(`<h3>📬 Входящие</h3><p style="color: var(--text-muted); text-align: center; padding: 20px;">Нет входящих приглашений</p>`);
            return;
        }
        
        Modal.open(`
            <h3> Входящие приглашения</h3>
            <div id="incoming-invitations">
                ${invitations.map(inv => `
                    <div style="padding: 15px; background: var(--surface); border-radius: var(--radius-lg); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div><strong>Приглашение в круг</strong><p style="color: var(--text-muted); font-size: 0.9em;">${Utils.formatTime(inv.created_at)}</p></div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-primary" onclick="CircleInvitations.handleResponse('${inv.id}', true)">✓</button>
                            <button class="btn btn-ghost" onclick="CircleInvitations.handleResponse('${inv.id}', false)">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);
    },
    
    async handleResponse(invitationId, accept) {
        const result = await Database.respondToInvitation(invitationId, accept);
        
        if (result) {
            Modal.close();
            Toast.show(accept ? 'Вы приняли приглашение! ✨' : 'Приглашение отклонено', 'success');
            await Renderer.renderCircle();
            this.checkIncomingInvitations();
        } else {
            Toast.show('Ошибка при обработке', 'error');
        }
    }
};

// ===== 12. РЕНДЕРИНГ =====
const Renderer = {
    async renderHomeStories() {
        const grid = document.getElementById('home-stories-grid');
        if (!grid) return;
        
        grid.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-muted);">Загрузка...</p>';
        
        try {
            const { data, error } = await Database.client
                .from('stories')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(6);
            
            if (error) throw error;
            
            State.stories = data || [];
            
            if (State.stories.length === 0) {
                grid.innerHTML = '<p style="text-align:center; padding: 20px;">Историй пока нет.</p>';
                return;
            }
            
            grid.innerHTML = State.stories.map(s => this.createStoryCard(s)).join('');
            this.attachStoryCardListeners(grid);
            
            await Promise.all(
                State.stories.map(async (story) => {
                    const comments = await Database.getComments(story.id);
                    const card = grid.querySelector(`[data-story-id="${story.id}"]`);
                    if (card) {
                        const countBtn = card.querySelector('[data-comments-count]');
                        if (countBtn) countBtn.textContent = `💬 ${comments.length}`;
                    }
                })
            );
        } catch (error) {
            grid.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--pink-500);">Ошибка загрузки.</p>';
        }
    },
    
    createStoryCard(story) {
        const topicNames = { 
            crafts: 'Ремесла', 
            literature: 'Литература', 
            science: 'Наука', 
            sport: 'Спорт', 
            art: 'Искусство', 
            volunteering: 'Волонтёрство' 
        };
        const topicIcons = { 
            crafts: '🛠', 
            literature: '📖', 
            science: '🔬', 
            sport: '⚽', 
            art: '🎨', 
            volunteering: '🌱' 
        };
        
        return `
            <article class="story-card" data-story-id="${story.id}">
                <div class="story-meta">
                    <span class="story-tag tag-${story.topic}">${topicIcons[story.topic] || '📌'} ${topicNames[story.topic] || story.topic}</span>
                    <span class="story-age">${story.author_age || '?'} лет</span>
                </div>
                <h4>${Utils.escapeHtml(story.title)}</h4>
                <p class="story-author">${Utils.escapeHtml(story.author_name)} • ${story.type === 'audio' ? '🎧 Аудио' : '🎬 Видео'}</p>
                <div class="story-actions">
                    <button class="btn btn-primary" data-open-story="${story.id}">${story.type === 'audio' ? ' Слушать' : '▶ Смотреть'}</button>
                    <button class="btn btn-ghost" data-comments-count="${story.id}">💬 0</button>
                </div>
            </article>`;
    },
    
    attachStoryCardListeners(container) {
        container.querySelectorAll('[data-open-story]').forEach(btn => {
            btn.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                window.location.hash = `story/${btn.dataset.openStory}`; 
            });
        });
        
        container.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', () => { 
                window.location.hash = `story/${card.dataset.storyId}`; 
            });
        });
    },
    
    async updateCommentCounts(container) {
        for (const card of container.querySelectorAll('.story-card')) {
            const comments = await Database.getComments(card.dataset.storyId);
            const countBtn = card.querySelector('[data-comments-count]');
            if (countBtn) countBtn.textContent = `💬 ${comments.length}`;
        }
    },
    
    async renderStory(storyId) {
        const story = State.stories.find(s => s.id === storyId) || (await Database.getStories()).find(s => s.id === storyId);
        
        if (!story) { 
            document.getElementById('story-detail-container').innerHTML = '<p>История не найдена.</p>'; 
            return; 
        }
        
        const topicNames = { 
            crafts: 'Ремесла', 
            literature: 'Литература', 
            science: 'Наука', 
            sport: 'Спорт', 
            art: 'Искусство', 
            volunteering: 'Волонтёрство' 
        };
        
        const container = document.getElementById('story-detail-container');
        container.innerHTML = `
            <article class="story-detail">
                <div class="story-detail-header">
                    <div class="story-avatar">${Utils.getInitials(story.author_name)}</div>
                    <div class="story-detail-info">
                        <h2>${Utils.escapeHtml(story.title)}</h2>
                        <div class="story-detail-meta"><span><strong>${Utils.escapeHtml(story.author_name)}</strong>, ${story.author_age || '?'} лет</span><span>•</span><span>${topicNames[story.topic] || story.topic}</span></div>
                    </div>
                </div>
                <div class="story-text"><p>${Utils.escapeHtml(story.text_content || story.text || 'Текст отсутствует.')}</p></div>
            </article>
            <section class="comments-section">
                <h3>💬 Комментарии (<span id="comments-count">0</span>)</h3>
                <div id="comments-list"><p style="color: var(--text-muted);">Загрузка...</p></div>
                <form class="comment-form" id="comment-form">
                    <textarea id="comment-text" placeholder="Поделитесь мыслями..." maxlength="1000" required></textarea>
                    <button type="submit" class="btn btn-primary">Отправить</button>
                </form>
            </section>`;
        
        await this.loadAndRenderComments(storyId);
        
        document.getElementById('comment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Auth.requireAuth()) return;
            
            const text = document.getElementById('comment-text').value.trim();
            if (!text) return;
            
            const user = Auth.getUser();
            const btn = e.target.querySelector('button[type="submit"]');
            
            btn.disabled = true; 
            btn.textContent = 'Отправка...';
            
            const result = await Database.addComment({ 
                story_id: storyId, 
                author_id: user.id, 
                author_name: user.name, 
                author_age: user.age, 
                author_photo: user.photo, 
                text 
            });
            
            if (result) {
                Toast.show('Комментарий добавлен ✨', 'success');
                document.getElementById('comment-text').value = '';
                await this.loadAndRenderComments(storyId);
            } else {
                Toast.show('Ошибка при отправке', 'error');
            }
            
            btn.disabled = false; 
            btn.textContent = 'Отправить';
        });
        
        SilentMode.markViewed();
    },
    
    async loadAndRenderComments(storyId) {
        const comments = await Database.getComments(storyId);
        const list = document.getElementById('comments-list');
        const countEl = document.getElementById('comments-count');
        
        if (!list || !countEl) return;
        
        countEl.textContent = comments.length;
        
        if (comments.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">Пока нет комментариев.</p>';
        } else {
            list.innerHTML = comments.map(c => {
                const hasPhoto = c.author_photo;
                const avatarContent = hasPhoto 
                    ? `<img src="${c.author_photo}" alt="${Utils.escapeHtml(c.author_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` 
                    : Utils.getInitials(c.author_name);
                
                return `
                    <article class="comment">
                        <div class="comment-avatar">${avatarContent}</div>
                        <div class="comment-body">
                            <div class="comment-header"><span class="comment-author">${Utils.escapeHtml(c.author_name)}, ${c.author_age || '?'}</span><span class="comment-time">${Utils.formatTime(c.created_at)}</span></div>
                            <p class="comment-text">${Utils.escapeHtml(c.text)}</p>
                        </div>
                    </article>`;
            }).join('');
        }
    },
    
    async renderExchange() {
        const grid = document.getElementById('exchange-grid');
        if (!grid) return;
        
        grid.innerHTML = '<p style="text-align:center; padding: 20px;">Загрузка...</p>';
        
        State.exchanges = await Database.getExchanges();
        
        if (State.exchanges.length === 0) { 
            grid.innerHTML = '<p style="text-align:center; padding: 20px;">Предложений пока нет.</p>'; 
            return; 
        }
        
        grid.innerHTML = State.exchanges.map(e => `
            <article class="exchange-card">
                <div class="exchange-card-header">
                    <div class="exchange-avatar">${Utils.getInitials(e.author_name)}</div>
                    <div><h4>${Utils.escapeHtml(e.author_name)}, ${e.author_age || '?'}</h4></div>
                </div>
                <div class="exchange-section teach"><div class="exchange-section-label">🎓 Учу</div><p>${Utils.escapeHtml(e.teach)}</p></div>
                <div class="exchange-section learn"><div class="exchange-section-label">🌱 Хочу научиться</div><p>${Utils.escapeHtml(e.learn)}</p></div>
                <button class="btn btn-primary" style="width: 100%;" data-exchange-id="${e.id}">🤝 Предложить обмен</button>
            </article>`).join('');
        
        grid.querySelectorAll('[data-exchange-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!Auth.requireAuth()) return;
                Toast.show('Заявка отправлена! (Демо)', 'success');
                btn.textContent = '✓ Отправлено'; 
                btn.disabled = true;
            });
        });
    },
    
    async renderCapsules() {
        const list = document.getElementById('capsules-list');
        if (!list) return;
        
        list.innerHTML = '<p style="text-align:center; padding: 20px;">Загрузка...</p>';
        
        const user = Auth.getUser();
        if (!user || !user.id) {
            list.innerHTML = '<div class="capsule-empty"><div class="empty-icon"></div><p>Войдите, чтобы увидеть свои капсулы</p></div>';
            return;
        }
        
        const { data, error } = await Database.client
            .from('capsules')
            .select('*')
            .eq('creator_id', user.id)
            .order('open_date', { ascending: true });
        
        if (error) {
            list.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--pink-500);">Ошибка загрузки</p>';
            return;
        }
        
        State.capsules = data || [];
        
        if (State.capsules.length === 0) {
            list.innerHTML = `
                <div class="capsule-empty" style="grid-column: 1/-1;">
                    <div class="empty-icon">⏳</div>
                    <p>У вас пока нет капсул времени</p>
                    <p style="font-size: 0.9em; opacity: 0.7;">Создайте первую капсулу — напишите письмо себе в будущее!</p>
                </div>`;
            return;
        }
        
        list.innerHTML = State.capsules.map(c => this.createCapsuleCard(c)).join('');
        Capsules.startTimers();
    },
    
    createCapsuleCard(capsule) {
        const now = new Date();
        const openDate = new Date(capsule.open_date);
        const diff = openDate - now;
        
        let status, statusText, icon, cardClass;
        
        if (diff <= 0) {
            status = 'opened';
            statusText = 'Можно открыть!';
            icon = '🎉';
            cardClass = 'opened';
        } else if (diff < 7 * 24 * 60 * 60 * 1000) {
            status = 'soon';
            statusText = 'Скоро откроется';
            icon = '⏳';
            cardClass = 'soon';
        } else {
            status = 'locked';
            statusText = 'Запечатана';
            icon = '🔒';
            cardClass = '';
        }
        
        const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));
        
        const timerText = diff <= 0 
            ? '🎉 Открыта!' 
            : `${days}д ${hours}ч ${minutes}м ${seconds}с`;
        
        const title = capsule.title || 'Без названия';
        
        return `
            <article class="capsule-card ${cardClass}" data-capsule-id="${capsule.id}" onclick="Capsules.open('${capsule.id}')">
                <span class="capsule-icon">${icon}</span>
                <h4>${Utils.escapeHtml(title)}</h4>
                <span class="capsule-group">👥 ${Utils.escapeHtml(capsule.group_name || 'Личная')}</span>
                <div class="capsule-timer" data-open-date="${capsule.open_date}">${timerText}</div>
                <div class="capsule-status">
                    <span class="dot"></span>
                    <span>${statusText}</span>
                </div>
            </article>`;
    },
    
    async renderCircle() {
        const grid = document.getElementById('circle-grid');
        if (!grid) return;
        
        grid.innerHTML = '<p style="text-align:center; padding: 20px;">Загрузка пользователей...</p>';
        
        const members = await Database.getCircleMembers();
        
        if (!members || members.length === 0) {
            grid.innerHTML = '<p class="circle-empty-state">Пока нет пользователей в вашем круге. Пригласите кого-нибудь!</p>';
            return;
        }
        
        grid.innerHTML = members.map(user => {
            const firstLetter = user.name && user.name.trim() ? user.name.trim().charAt(0).toUpperCase() : '?';
            const hasPhoto = user.photo_url && user.photo_url.trim() !== '';
            
            return `
            <article class="user-card">
                <div class="user-avatar-wrapper">
                    ${hasPhoto ? `<img src="${user.photo_url}" alt="${Utils.escapeHtml(user.name)}" class="user-avatar">` : `<div class="user-avatar-placeholder">${firstLetter}</div>`}
                </div>
                <h4>${Utils.escapeHtml(user.name)}</h4>
                <p class="user-age">${user.age || '?'} лет</p>
                <p class="user-bio">${Utils.escapeHtml(user.bio || 'Нет информации')}</p>
                <button class="btn btn-primary btn-chat" onclick="Chat.open('${user.id}', '${Utils.escapeHtml(user.name)}', '${user.photo_url || ''}')">💬 Написать</button>
            </article>`;
        }).join('');
    },
    
    async renderChat(otherUserId) {
        const currentUser = Auth.getUser();
        
        if (!currentUser || !currentUser.id) { 
            Toast.show('Ошибка: вы не авторизованы', 'error'); 
            return; 
        }
        
        const container = document.getElementById('chat-page-messages');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Загрузка сообщений...</p>';
        
        const { data: allMessages, error } = await Database.client
            .from('private_messages')
            .select('*')
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: true });
        
        if (error) { 
            container.innerHTML = '<p style="text-align: center; color: var(--pink-500); padding: 40px;">Ошибка загрузки чата.</p>';
            return; 
        }
        
        const messages = allMessages.filter(msg => 
            (msg.sender_id === currentUser.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === currentUser.id)
        );
        
        if (messages.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Начните общение первым! 👋</p>';
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isOwn = msg.sender_id === currentUser.id;
            return `
            <div class="message ${isOwn ? 'message-own' : 'message-other'}" style="display: flex; justify-content: ${isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 10px;">
                <div style="max-width: 70%; padding: 10px 15px; border-radius: 18px; ${isOwn ? 'background: var(--gradient-primary); color: white;' : 'background: var(--surface); border: 1px solid var(--border);'}">
                    <div style="margin-bottom: 5px; word-wrap: break-word;">${Utils.escapeHtml(msg.text)}</div>
                    <div style="font-size: 0.75em; opacity: 0.7; text-align: right;">${Utils.formatTime(msg.created_at)}</div>
                </div>
            </div>`;
        }).join('');
        
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
};

// ===== 13. РЕЖИМ ТИШИНЫ =====
const SilentMode = {
    init() {
        this.updateCounter();
        document.getElementById('btn-pause')?.addEventListener('click', () => Toast.show('🌿 Хорошая идея — выйти на прогулку', 'info', 4000));
        document.getElementById('btn-continue')?.addEventListener('click', () => {
            State.viewedStories = 0; 
            sessionStorage.setItem('bridge_viewed', '0');
            this.updateCounter(); 
            Toast.show('Продолжаем путешествие ✨', 'success');
        });
    },
    
    markViewed() {
        State.viewedStories++; 
        sessionStorage.setItem('bridge_viewed', State.viewedStories);
        this.updateCounter();
        
        if (State.viewedStories >= State.silentLimit) Toast.show('🍵 Вы достигли лимита. Сделайте перерыв!', 'warning', 5000);
    },
    
    updateCounter() {
        const counter = document.getElementById('silent-counter');
        const bar = document.getElementById('silent-progress-bar');
        
        if (counter) counter.textContent = `Вы просмотрели ${State.viewedStories} из ${State.silentLimit} историй сегодня.`;
        if (bar) bar.style.width = Math.min(100, (State.viewedStories / State.silentLimit) * 100) + '%';
    }
};

// ===== 14. РОУТЕР =====
const Router = {
    init() { 
        window.addEventListener('hashchange', () => this.handleRoute()); 
        this.handleRoute(); 
    },
    
    handleRoute() {
        const hash = window.location.hash.slice(1) || 'home';
        const [page, param] = hash.split('/');
        
        if (page === 'topic' && param) this.navigate('topic', param);
        else if (page === 'story' && param) this.navigate('story', param);
        else if (page === 'chat' && param) this.navigate('chat', param);
        else this.navigate(page);
    },
    
    async navigate(page, param = null) {
        if (page !== 'chat') {
            document.body.classList.remove('chat-open');
        }
        
        State.previousPage = State.currentPage; 
        State.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        let targetId = page === 'topic' ? 'page-topic' : (page === 'story' ? 'page-story' : (page === 'chat' ? 'page-chat' : `page-${page}`));
        
        if (page === 'story') { 
            State.currentStory = param; 
            await Renderer.renderStory(param); 
        } else if (page === 'chat') { 
            await Chat.loadPage(param); 
        } else if (page === 'exchange') { 
            await Renderer.renderExchange(); 
            State.exchangesLoaded = true; 
        } else if (page === 'archive') { 
            await Renderer.renderCapsules(); 
            State.capsulesLoaded = true; 
            Capsules.startTimers();
        } else if (page === 'circle') { 
            await Renderer.renderCircle(); 
            State.circleLoaded = true; 
        }
        
        const target = document.getElementById(targetId);
        if (target) { 
            target.classList.add('active'); 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        }
        
        document.querySelectorAll('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    }
};

// ===== 15. ОБРАБОТЧИКИ =====
const EventHandlers = {
    init() {
        // Кнопки "Назад"
        document.querySelectorAll('[data-back]').forEach(btn => {
            btn.addEventListener('click', () => { 
                window.location.hash = btn.dataset.back || State.previousPage || 'home'; 
            });
        });
        
        document.getElementById('story-back-btn')?.addEventListener('click', () => {
            window.location.hash = State.currentTopic ? `topic/${State.currentTopic}` : (State.previousPage || 'home');
        });
        
        // Выход из чата
        document.addEventListener('click', (e) => {
            if (e.target.closest('[onclick*="window.location.hash = \'#circle\'"]')) {
                document.body.classList.remove('chat-open');
            }
        });
        
        // Табы
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });
        
        // Сброс данных
        document.getElementById('btn-reset-data')?.addEventListener('click', () => {
            if (confirm('Сбросить локальные настройки?')) {
                localStorage.removeItem('bridge_silent_limit');
                sessionStorage.removeItem('bridge_viewed');
                location.reload();
            }
        });
        
        // Создание предложения обмена
        document.getElementById('btn-create-offer').addEventListener('click', () => {
            if (!Auth.requireAuth()) return;
            
            Modal.open(`
                <h3>✨ Предложить навык</h3>
                <form id="exchange-form">
                    <div class="field-group"><label>Что вы можете научить?</label><textarea id="offer-teach" required></textarea></div>
                    <div class="field-group"><label>Чему хотите научиться?</label><textarea id="offer-learn" required></textarea></div>
                    <button type="submit" class="btn btn-gradient" style="width: 100%; margin-top: 10px;">Опубликовать</button>
                </form>
            `);
            
            document.getElementById('exchange-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = Auth.getUser();
                const result = await Database.addExchange({
                    author_id: user.id, 
                    author_name: user.name, 
                    author_age: user.age,
                    teach: document.getElementById('offer-teach').value.trim(),
                    learn: document.getElementById('offer-learn').value.trim(), 
                    type: 'both'
                });
                
                if (result) { 
                    Modal.close(); 
                    Toast.show('Опубликовано! ✨', 'success'); 
                    await Renderer.renderExchange(); 
                }
            });
        });
        
        // Создание капсулы
        document.getElementById('btn-create-capsule').addEventListener('click', () => {
            Capsules.showCreateModal();
        });
        
        // Настройки режима тишины
        document.getElementById('silent-settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const limit = parseInt(e.target.querySelector('input[name="limit"]:checked').value);
            State.silentLimit = limit; 
            localStorage.setItem('bridge_silent_limit', limit);
            SilentMode.updateCounter(); 
            Toast.show('Настройки сохранены 💾', 'success');
        });
    }
};

// ===== 16. УВЕДОМЛЕНИЯ =====
const Notifications = {
    data: [], 
    unreadCount: 0, 
    subscription: null,
    
    init() {
        const btn = document.getElementById('btn-notifications');
        const dropdown = document.getElementById('notifications-dropdown');
        const markAllBtn = document.getElementById('btn-mark-all-read');
        
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) this.markAllAsRead();
        });
        
        document.addEventListener('click', () => { 
            dropdown.style.display = 'none'; 
        });
        
        markAllBtn?.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            this.markAllAsRead(); 
        });
        
        const checkAuthAndSubscribe = () => {
            const user = Auth.getUser();
            if (user && user.id) { 
                this.loadNotifications(); 
                this.subscribeToRealTime(); 
            } else { 
                setTimeout(checkAuthAndSubscribe, 500); 
            }
        };
        
        checkAuthAndSubscribe();
    },
    
    async loadNotifications() {
        const user = Auth.getUser();
        if (!user || !user.id) return;
        
        const invitations = await Database.getIncomingInvitations();
        this.data = invitations.map(inv => ({
            id: `invitation_${inv.id}`, 
            type: 'invitation', 
            title: '📨 Новое приглашение',
            message: `Вас пригласили в круг`, 
            time: inv.created_at, 
            read: false, 
            link: '#circle'
        }));
        
        this.updateUI();
    },
    
    subscribeToRealTime() {
        const user = Auth.getUser();
        if (!user || !user.id) return;
        
        const supabase = window.supabaseClient;
        
        this.subscription = supabase.channel('notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'circle_invitations', 
                filter: `receiver_email=eq.${user.email}` 
            }, (payload) => {
                this.add({ 
                    id: `invitation_${payload.new.id}`, 
                    type: 'invitation', 
                    title: '📨 Новое приглашение', 
                    message: 'Вас пригласили в круг', 
                    time: payload.new.created_at, 
                    read: false, 
                    link: '#circle' 
                });
                Toast.show('Вас пригласили в круг! 📬', 'info', 5000);
            })
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'private_messages', 
                filter: `receiver_id=eq.${user.id}` 
            }, (payload) => {
                this.add({ 
                    id: `message_${payload.new.id}`, 
                    type: 'message', 
                    title: '💬 Новое сообщение', 
                    message: 'У вас новое сообщение', 
                    time: payload.new.created_at, 
                    read: false, 
                    link: `#chat/${payload.new.sender_id}` 
                });
                Toast.show('У вас новое сообщение! 💬', 'info', 5000);
            })
            .subscribe();
    },
    
    add(notification) {
        this.data.unshift(notification);
        this.updateUI();
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, { 
                body: notification.message, 
                icon: '/logo.svg' 
            });
        }
    },
    
    markAllAsRead() {
        this.data.forEach(n => n.read = true);
        this.updateUI();
    },
    
    updateUI() {
        const countEl = document.getElementById('notifications-count');
        const listEl = document.getElementById('notifications-list');
        
        this.unreadCount = this.data.filter(n => !n.read).length;
        
        if (countEl) {
            countEl.textContent = this.unreadCount;
            countEl.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
        
        if (this.data.length === 0) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Нет уведомлений</p>';
        } else {
            listEl.innerHTML = this.data.map(n => `
                <div style="padding: 12px 15px; border-bottom: 1px solid var(--border); ${n.read ? 'opacity: 0.6;' : 'background: var(--surface-warm);'} cursor: pointer;" onclick="Notifications.handleClick('${n.id}', '${n.link}')">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${n.title}</div>
                            <div style="font-size: 0.9em; color: var(--text-muted);">${n.message}</div>
                            <div style="font-size: 0.8em; color: var(--text-faint); margin-top: 5px;">${Utils.formatTime(n.time)}</div>
                        </div>
                        ${!n.read ? '<span style="width: 8px; height: 8px; background: var(--pink-500); border-radius: 50%; flex-shrink: 0;"></span>' : ''}
                    </div>
                </div>`).join('');
        }
    },
    
    handleClick(id, link) {
        const notification = this.data.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.updateUI();
            if (link) window.location.hash = link;
        }
    },
    
    cleanup() { 
        if (this.subscription) this.subscription.unsubscribe(); 
    }
};

// ===== 17. МОДАЛКА АВАТАРКИ =====
const AvatarModal = {
    init() {
        const overlay = document.getElementById('avatar-modal');
        const closeBtn = document.getElementById('avatar-modal-close');
        
        closeBtn?.addEventListener('click', () => this.close());
        overlay?.addEventListener('click', (e) => { 
            if (e.target === overlay) this.close(); 
        });
        
        document.addEventListener('keydown', (e) => { 
            if (e.key === 'Escape' && overlay?.classList.contains('active')) this.close(); 
        });
    },
    
    open(imageUrl) {
        const overlay = document.getElementById('avatar-modal');
        const img = document.getElementById('avatar-modal-img');
        
        if (img && imageUrl) { 
            img.src = imageUrl; 
            overlay?.classList.add('active'); 
            document.body.style.overflow = 'hidden'; 
        }
    },
    
    close() {
        const overlay = document.getElementById('avatar-modal');
        overlay?.classList.remove('active'); 
        document.body.style.overflow = '';
    }
};

// ===== 18. ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async () => {
    Toast.init(); 
    Modal.init(); 
    Theme.init(); 
    Auth.init(); 
    Profile.init();
    SilentMode.init(); 
    EventHandlers.init(); 
    AvatarModal.init();
    Chat.init(); 
    CircleInvitations.init(); 
    Notifications.init();
    await Renderer.renderHomeStories();
    Router.init();
});