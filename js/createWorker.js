// 分块文件的大小
const CHUNK_SIZE = 1024 * 1024 * 1
// 分配线程数的数量
const THREAD_COUNT = navigator.hardwareConcurrency || 4

export function createThread(file, doneUploadChunkList) {
    return new Promise((resolve) => {
        // 计算分块数量
        const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
        // 计算每个线程处理的分块数量
        const threadChunkCount = Math.ceil(chunkCount / THREAD_COUNT)

        console.info(`该文件需要分${chunkCount}块，每个线程需要处理${threadChunkCount}块`)

        let result = []

        let createThreadNumber = 0

        let doneThreadNumber = 0

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

            // worker线程创建失败
            worker.onerror = (error) => {
                console.info(error)
            }

            // 给worker传递信息
            worker.postMessage({
                file,
                CHUNK_SIZE,
                start,
                end,
                doneUploadChunkList,
            })

            createThreadNumber++

            worker.onmessage = (e) => {
                // console.info('e', e.data)
                // 收到每个worker线程传回来的结果
                e.data.forEach(chunk => {
                    result[chunk.chunkIndex] = chunk
                });

                doneThreadNumber++

                // 销毁这个线程
                worker.terminate()

                if (doneThreadNumber === createThreadNumber) {
                    resolve(result)
                }
            }

        }

    })
} 