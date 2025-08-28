const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const taskIdInput = document.getElementById('task-id');
const namaGarapanInput = document.getElementById('nama-garapan');
const tugasGarapanInput = document.getElementById('tugas-garapan');
const linkInput = document.getElementById('link');
const banyakAkunInput = document.getElementById('banyak-akun');
const keteranganInput = document.getElementById('keterangan');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');


let tasks = JSON.parse(localStorage.getItem('airdropTasks')) || [];
let isEditMode = false;

function saveTasks() {
    localStorage.setItem('airdropTasks', JSON.stringify(tasks));
}

function renderTasks() {
    taskList.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.nama.toLowerCase().includes(searchTerm) ||
                              task.tugas.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'Semua' || task.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        const isSelesai = task.selesaiHariIni ? 'selesai' : 'belum';
        const statusText = task.selesaiHariIni ? '✓ Selesai' : 'X Belum';

        row.innerHTML = `
            <td>${task.nama}</td>
            <td>${task.tugas}</td>
            <td>
                <a href="${task.link}" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="open-link" 
                   data-id="${task.id}"
                >Open</a>
            </td>
            <td>${task.akun}</td>
            <td><span class="status ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
            <td>
                <button class="today-btn ${isSelesai}" 
                        data-id="${task.id}"
                        ${task.selesaiHariIni ? 'disabled' : ''}
                >${statusText}</button>
            </td>
            <td>${task.tanggalDitambahkan}</td>
            <td>
                <button class="action-btn end-btn" data-id="${task.id}">End</button>
                <button class="action-btn edit-btn" data-id="${task.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${task.id}">Hapus</button>
            </td>
        `;
        taskList.appendChild(row);
    });
}

function handleFormSubmit(e) {
    e.preventDefault();

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newTask = {
        id: isEditMode ? parseInt(taskIdInput.value) : Date.now(),
        nama: namaGarapanInput.value.trim(),
        tugas: tugasGarapanInput.value.trim(),
        link: linkInput.value.trim(),
        akun: parseInt(banyakAkunInput.value),
        status: keteranganInput.value,
        selesaiHariIni: false,
        tanggalDitambahkan: formattedDate
    };

    if (isEditMode) {
        tasks = tasks.map(task => task.id === newTask.id ? { ...newTask, tanggalDitambahkan: task.tanggalDitambahkan } : task);
        isEditMode = false;
    } else {
        tasks.push(newTask);
    }
    
    saveTasks();
    renderTasks();
    resetForm();
}

function handleTableClick(e) {
    const target = e.target;
    const id = parseInt(target.dataset.id);

    if (target.classList.contains('delete-btn')) {
        if (confirm('Apakah Anda yakin ingin menghapus task ini?')) {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
        }
    } else if (target.classList.contains('edit-btn')) {
        const taskToEdit = tasks.find(task => task.id === id);
        if (taskToEdit) {
            isEditMode = true;
            taskIdInput.value = taskToEdit.id;
            namaGarapanInput.value = taskToEdit.nama;
            tugasGarapanInput.value = taskToEdit.tugas;
            linkInput.value = taskToEdit.link;
            banyakAkunInput.value = taskToEdit.akun;
            keteranganInput.value = taskToEdit.status;
            formTitle.textContent = "Edit Garapan";
            submitBtn.textContent = "Update";
            window.scrollTo(0, 0);
        }
    } else if (target.classList.contains('end-btn')) {
        tasks = tasks.map(task =>
            task.id === id ? { ...task, status: "END" } : task
        );
        saveTasks();
        renderTasks();
    } else if (target.classList.contains('open-link')) {
        const taskToUpdate = tasks.find(task => task.id === id);
        if (taskToUpdate) {
            taskToUpdate.selesaiHariIni = true;
            saveTasks();
            renderTasks();
        }
    }
}

function resetForm() {
    taskForm.reset();
    isEditMode = false;
    taskIdInput.value = '';
    formTitle.textContent = "Tambah Garapan Baru";
    submitBtn.textContent = "Tambah";
}

function checkAndResetDailyStatus() {
    const RESET_HOUR_WIB = 7;
    
    const nextResetTimestamp = localStorage.getItem('nextResetTimestamp');
    const now = new Date();

    if (!nextResetTimestamp || now.getTime() >= parseInt(nextResetTimestamp)) {
        console.log('Waktu reset terlewati! Mereset status harian...');

        tasks = tasks.map(task => ({ ...task, selesaiHariIni: false }));
        saveTasks();

        const nextResetDate = new Date();
        nextResetDate.setHours(RESET_HOUR_WIB, 0, 0, 0);

        if (now.getTime() >= nextResetDate.getTime()) {
            nextResetDate.setDate(nextResetDate.getDate() + 1);
        }

        localStorage.setItem('nextResetTimestamp', nextResetDate.getTime());
        console.log(`Reset berikutnya dijadwalkan pada: ${nextResetDate}`);
    }
}

taskForm.addEventListener('submit', handleFormSubmit);
taskList.addEventListener('click', handleTableClick);
resetBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', renderTasks);
filterStatus.addEventListener('change', renderTasks);

checkAndResetDailyStatus();
renderTasks();