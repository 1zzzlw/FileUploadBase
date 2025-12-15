import { sendFile } from './uploadApi.js';

const $ = document.querySelector.bind(document)

const doms = {
    dragArea: $('.drag-area'),
    inputFile: $('.input-file'),
    inputDirectory: $('.input-directory'),
    uploadFile: $('.button-upload-file'),
    uploadDirection: $('.button-upload-directory'),
    downloadList: $('.download-list'),
    downloadProcessInfo: $('.download-processInfo'),
}


class FileBaseInfo {
    constructor(file) {
        this.file = file
        this.fileName = file.name
        this.fileType = file.type
        this.fileSize = file.size
        this.process = 0
        this.startProcess = 0
        this.endProcess = 100
    }
}

class FileListStatus {
    constructor() {
        this.fileInfoList = []
        this.processList = []
        this.buttonAgainList = []
        this.buttonEndList = []
        this.initEventListener()
    }

    initEventListener() {
        doms.uploadFile.onclick = () => {
            doms.inputFile.click()
        }

        doms.inputFile.onchange = (e) => {
            for (const file of e.target.files) {
                this.addFileToList(file)
            }
        }

        doms.uploadDirection.onclick = () => {
            doms.inputDirectory.click()
        }

        doms.inputDirectory.onchange = (e) => {
            for (const file of e.target.files) {
                this.addFileToList(file)
            }
        }

        // 进入
        doms.dragArea.ondragenter = (e) => {
            // 禁用掉默认事件
            e.preventDefault();
            doms.dragArea.classList.add('dragenter')
        }

        // 停留
        doms.dragArea.ondragover = (e) => {
            e.preventDefault();
            doms.dragArea.classList.add('dragenter')
        }

        // 离开
        doms.dragArea.ondragleave = (e) => {
            e.preventDefault();
            doms.dragArea.classList.remove('dragenter')
        }

        // 松手
        doms.dragArea.ondrop = (e) => {
            e.preventDefault();
            doms.dragArea.classList.remove('dragenter')
            // 获得拖拽的所有内容
            const items = e.dataTransfer.items
            for (const item of items) {
                const entry = item.webkitGetAsEntry()
                this.traverseDirectory(entry)
            }
        }

        doms.downloadList.addEventListener('click', (e) => {
            const child = doms.downloadList.querySelectorAll('.info-list')
            for (let i = 0; i < child.length; i++) {
                if (e.target.classList.contains(`button-again-${i}`)) {
                    this.processList[i].classList.remove('active')
                    this.buttonEndList[i].classList.remove('active')
                    this.buttonAgainList[i].classList.add('active')
                } else if (e.target.classList.contains(`button-end-${i}`)) {
                    this.processList[i].classList.add('active')
                    this.buttonEndList[i].classList.add('active')
                    this.buttonAgainList[i].classList.remove('active')
                }
            }
            console.info(this.processList)
        })
    }

    // 遍历文件夹
    traverseDirectory(entry) {
        if (entry.isDirectory) {
            // 如果是文件夹，重新遍历 先创建一个文件夹读取器
            const reader = entry.createReader()
            reader.readEntries((entrys) => {
                for (const entry of entrys) {
                    if (entry.isDirectory) {
                        // 如果内部还是文件夹，重新遍历
                        this.traverseDirectory(entry)
                    } else {
                        // 是文件，直接加入文件列表
                        entry.file((file) => {
                            this.addFileToList(file)
                        })
                    }
                }
            })

        } else {
            // 如果是文件，直接更新文件列表
            console.info(entry)
            entry.file((file) => {
                this.addFileToList(file)
            })
        }
    }

    // 添加文件到列表中
    addFileToList(file) {
        const fileInfo = new FileBaseInfo(file)
        this.fileInfoList.push(fileInfo)
        updateInfoList(fileInfo, this.fileInfoList.length - 1)
    }
}

const fileListStatus = new FileListStatus()

function updateInfoList(fileInfo, index) {
    console.info(fileInfo)

    const infoList = document.createElement('div')
    infoList.className = 'info-list'
    infoList.innerHTML = ` 
        <img src="./icon/wenjian.svg" alt="文件预览图片" class="file-preview" />
        <div class="download-processInfo">
            <div class="baseInfo">
                <span>${fileInfo.fileName}</span>
                <span>${fileInfo.fileType}</span>
                <span>${fileInfo.fileSize}</span>
                <span>状态</span>
            </div>  
            <div class="process process-${index}"></div>
        </div>
        <div class="button-control">
            <button class="button-again-${index} active">重新上传</button>
            <button class="button-end-${index}">取消上传</button>
        </div>
    `
    const process = infoList.querySelector(`.process-${index}`)
    const buttonAgainList = infoList.querySelector(`.button-again-${index}`)
    const buttonEndList = infoList.querySelector(`.button-end-${index}`)
    fileListStatus.processList.push(process)
    fileListStatus.buttonAgainList.push(buttonAgainList)
    fileListStatus.buttonEndList.push(buttonEndList)
    doms.downloadList.appendChild(infoList)
    /** 
     * 传递一个就上传一个，关键是需要记住process的进度
     * 否则选择新的文件长传的时候会刷新进度为0
     */
    uploadFile(fileInfo, index)
}

async function uploadFile(fileInfo, index) {
    const formData = new FormData()

    const file = fileInfo.file

    console.info(file)

    formData.append('file', file)

    // 配置监听传输的进程
    const config = {
        onUploadProgress: (e) => {
            // 如果文件大小未知，直接退出
            if (!e.lengthComputable) return
            const loaded = e.loaded
            // 四舍五入
            const process = Math.round(loaded / file.size * 100)
            fileListStatus.processList[index].style.setProperty('--process', process)
        }
    }

    await sendFile(formData, config).then((res) => {
        console.info('发送成功', res.data)
    }).catch((error) => {
        console.info(error)
    })
}


