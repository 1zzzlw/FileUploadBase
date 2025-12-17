import { sendFileChunkApi, uploadSuccessFileChunkApi, mergeFileChunkApi } from './uploadApi.js';
import { createThread } from './fileChunkWorker.js';

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

const status = {
    waitting: '等待上传',
    uploading: '上传中',
    paused: '已暂停',
    success: '上传成功',
    failed: '上传失败',
}

class FileBaseInfo {
    constructor(file) {
        this.file = file
        this.fileName = file.name
        this.fileType = file.type
        this.fileSize = file.size
        this.fileStatus = status.uploading
        this.fileHash = ''
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
    const infoList = document.createElement('div')
    infoList.className = 'info-list'
    infoList.innerHTML = ` 
        <img src="./icon/wenjian.svg" alt="文件预览图片" class="file-preview" />
        <div class="download-processInfo">
            <div class="baseInfo">
                <span>${fileInfo.fileName}</span>
                <span>${fileInfo.fileType}</span>
                <span>${fileInfo.fileSize}</span>
                <span>${fileInfo.fileStatus}</span>
            </div>  
            <div class="process process-${index}"></div>
        </div>
        <div class="button-control">
            <button class="button-again-${index} active">重新上传</button>
            <button class="button-end-${index}">取消上传</button>
        </div>
    `
    const process = infoList.querySelector(`.process-${index}`)
    process.style.setProperty('--process', fileInfo.process)
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
    const file = fileInfo.file

    // 文件上传之前，从后端获取已经上传过的分块文件
    // const fileHash = file.fileHash

    const fileHash = localStorage.getItem(`fileHash-${fileInfo.fileName}`)

    // TODO 这里要么使用前端缓存存储hash这一个办法解决刷新丢失问题了，我目前可以暂时使用localstorge来存储，IM项目中可以使用本地SQLite3数据库进程存储文件信息
    let doneUploadChunkList = []
    if (fileHash !== '') {
        doneUploadChunkList = await uploadSuccessFileChunk(fileHash)
    }

    // 多线程分块
    multiThreadUpload(fileInfo, file, index, doneUploadChunkList, fileHash)

    // 测试不使用worker线程来计算文件的hash和分块
    // singleThreadUpload(fileInfo, file, index)

    // 获得完整文件的hash
    // getFileHash(file)
}

async function uploadSuccessFileChunk(fileHash) {

    let doneUploadChunkList = []

    await uploadSuccessFileChunkApi(fileHash).then((res) => {
        doneUploadChunkList = res.data.data
    })

    return doneUploadChunkList
}

async function multiThreadUpload(fileInfo, file, index, doneUploadChunkList, fileHash) {
    // 对文件进行切片，得到
    createThread(file, doneUploadChunkList, fileHash, (e) => {
        const fileHash = e.fileKey
        if (e.fileTask === null) {
            // 说明所以的分块都上传过一次了，直接进行合并
            mergeFile(fileHash, fileInfo, index)
            return
        }
        const { chunkIndex, chunkHash, chunkBlob } = e.fileTask
        const isNeedMerge = e.isNeedMerge
        // 解决刷新状态丢失的问题
        localStorage.setItem(`fileHash-${fileInfo.fileName}`, fileHash)
        fileInfo.fileHash = fileHash
        upload(fileInfo, chunkIndex, chunkHash, chunkBlob, fileHash, index, isNeedMerge)
    })

}

async function singleThreadUpload(fileInfo, file, index) {
    // 测试不使用worker线程来计算文件的hash和分块
    const chunks1 = await computedFileChunk(file)

    const fileHash = chunks1.fileHash

    localStorage.setItem(`fileHash-${fileInfo.fileName}`, fileHash)

    console.info('chunks1', chunks1.chunks)

    for (let i = 0; i < chunks1.chunks.length; i++) {
        console.info(i)
        const { chunkIndex, chunkHash, chunkBlob } = chunks1.chunks[i]

        upload(fileInfo, chunkIndex, chunkHash, chunkBlob, fileHash, index)
    }

}

async function upload(fileInfo, chunkIndex, chunkHash, chunkBlob, fileHash, index, isNeedMerge) {
    const formData = new FormData()

    formData.append('chunkBlob', chunkBlob)
    formData.append('chunkIndex', chunkIndex)
    formData.append('chunkHash', chunkHash)
    formData.append('fileHash', fileHash)

    // 配置监听传输的进程
    const config = {
        onUploadProgress: (e) => {
            // 如果文件大小未知，直接退出
            if (!e.lengthComputable) return
            const chunkLoaded = e.loaded
            // 四舍五入
            let process = fileInfo.process
            process += Math.ceil(chunkLoaded / fileInfo.fileSize * 100)

            process = process > 100 ? 100 : process

            // 更新文件信息的进度条
            fileInfo.process = process
            fileListStatus.processList[index].style.setProperty('--process', process)
        }
    }

    await sendFileChunkApi(formData, config).then((res) => {
        console.info('发送成功', res.data)
        fileInfo.fileStatus = status.success
    }).catch((error) => {
        console.info(error)
    })

    if (isNeedMerge) {
        // 需要进行融合
        mergeFile(fileHash, fileInfo, index)
    }
}

async function mergeFile(fileHash, fileInfo, index) {
    await mergeFileChunkApi(fileHash, fileInfo.fileName).then((res) => {
        console.info('合并成功')
        fileInfo.process = 100
        fileListStatus.processList[index].style.setProperty('--process', 100)
    })
}

// 测试不使用worker线程来计算文件的hash和分块
function computedFileChunk(file) {
    return new Promise((resolve) => {
        console.info('file.size ====> ', file.size)

        const CHUNK_SIZE = 1024 * 1024 * 1

        const chunkCount = Math.ceil(file.size / CHUNK_SIZE)

        const chunkSpark = new SparkMD5.ArrayBuffer()

        let processedChunks = 0

        let result = []

        const fileSpark = new SparkMD5.ArrayBuffer()

        console.info('chunkCount ===> ', chunkCount)

        for (let i = 0; i < chunkCount; i++) {
            const start = i * CHUNK_SIZE
            let end = start + CHUNK_SIZE

            if (end > file.size) end = file.size

            // 每个blob新建独立的FileReader
            const fileReader = new FileReader()

            const blob = file.slice(start, end)

            fileReader.onload = (e) => {

                chunkSpark.append(e.target.result)
                fileSpark.append(e.target.result)

                const chunkHash = chunkSpark.end()

                console.info(`第${i}个块的hash值是${chunkHash}`)

                processedChunks++

                if (processedChunks == chunkCount) {
                    const fileHash = fileSpark.end()
                    console.info(`总文件的hash值是${fileHash}`)
                    resolve({
                        chunks: result,
                        fileHash: fileHash
                    })
                }

                result.push({
                    chunkIndex: i,
                    chunkHash: chunkHash,
                    chunkBlob: blob
                })
            }

            fileReader.readAsArrayBuffer(blob)
        }
    })
}

function getFileHash(file) {

    const fileReader = new FileReader()

    const spark = new SparkMD5.ArrayBuffer()

    fileReader.onload = (e) => {
        // const hash = SparkMD5.ArrayBuffer.hash(e.target.result)

        spark.append(e.target.result)

        console.info(spark.end())
    }

    fileReader.readAsArrayBuffer(file)
}

window.printf = function () {
    console.info(fileListStatus)
}

