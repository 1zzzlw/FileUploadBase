// 每个文件有一个独立的状态管理集合
const fileTaskMap = new Map();
// 每个文件的合并状态管理集合
const fileThreadNumberMap = new Map()
// 分块文件的大小
const CHUNK_SIZE = 1024 * 1024 * 1
// 分配线程数的数量
const THREAD_COUNT = navigator.hardwareConcurrency / 4

// 创建文件的唯一key
function createUniqueFileKey(file) {
    // key的组成：文件名称_文件大小_文件最后修改时间戳
    return `${file.name}_${file.size}_${file.lastModified}`
}

export function createThread(file, doneUploadChunkList, fileHash, callback) {
    // 计算分块数量
    const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
    // 计算每个线程处理的分块数量
    const threadChunkCount = Math.ceil(chunkCount / THREAD_COUNT)

    console.info(`该文件需要分${chunkCount}块，每个线程需要处理${threadChunkCount}块`)

    const fileKey = createUniqueFileKey(file)

    fileTaskMap.set(fileKey, {
        chunkIndex: null,
        chunkHash: null,
        chunkArrayBuffer: null,
        chunkBlob: null,
        isUploaded: false,
        isDoneThread: false,
    })

    fileThreadNumberMap.set(fileKey, {
        createThreadNumber: 0,
        doneThreadNumber: 0
    })

    const fileThreadNumber = fileThreadNumberMap.get(fileKey)

    // 循环遍历可以创建的线程数量，给每个线程开辟一个worker后台处理线程
    for (let i = 0; i < THREAD_COUNT; i++) {

        const start = i * threadChunkCount

        let end = (i + 1) * threadChunkCount

        if (end > chunkCount) end = chunkCount

        if (start >= end) {
            // 这种情况说明创建了无用的线程，直接continue
            continue
        }

        // console.info(start, end)

        const worker = new Worker('./../js/worker.js')

        // 线程创建成功
        fileThreadNumber.createThreadNumber++

        // worker线程创建失败
        worker.onerror = (error) => {
            console.info(error)
            fileThreadNumber.doneThreadNumber++;
            worker.terminate();
        }

        // 给worker传递信息
        worker.postMessage({
            file,
            CHUNK_SIZE,
            start,
            end,
            doneUploadChunkList,
            fileTaskMap,
            fileKey
        })

        worker.onmessage = (e) => {
            // console.info('创建的线程数量', createThreadNumber)
            const fileTaskMap = e.data.fileTaskMap
            const fileKey = e.data.fileKey

            const fileThreadNumber = fileThreadNumberMap.get(fileKey)
            const fileTask = fileTaskMap.get(fileKey)

            // console.info(fileTask)

            if (fileTask.isUploaded) {
                fileThreadNumber.doneThreadNumber++;
                worker.terminate();
                if (isMerge(fileThreadNumber)) {
                    const isNeedMerge = true
                    const fileTask = null
                    callback({ fileTask, isNeedMerge, fileKey })
                }
                return
            }

            if (fileTask.isDoneThread) {
                // 销毁这个线程
                fileThreadNumber.doneThreadNumber++
                worker.terminate()
            }

            const isNeedMerge = isMerge(fileThreadNumber)

            callback({ fileTask, isNeedMerge, fileKey })
        }

        // 判断是否需要合并文件
        function isMerge(fileThreadNumber) {
            return fileThreadNumber.createThreadNumber === fileThreadNumber.doneThreadNumber ? true : false
        }

    }
} 