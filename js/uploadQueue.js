import { sendFileChunkApi } from './uploadApi.js'

// 设置文件并行发送的请求数量
const UPLOAD_NUMBER_LIMIT = 1

export class createTaskQueue {
    constructor() {
        // 最大并行数量
        this.maxRunningCount = UPLOAD_NUMBER_LIMIT
        // 正在文件传输的数量
        this.fileRunningCount = 0
        // 分块文件等待队列
        this.fileChunkWaitingQueue = new Map()
        // 记录正在上传的文件队列
        this.fileRunningQueue = []
    }

    async uploadSingleChunk(fileData) {
        try {
            // 配置监听传输的进程
            const config = {
                onUploadProgress: (e) => {
                    // console.info(e.loaded)
                }
            }
            await sendFileChunkApi(fileData, config); // 等待分块上传完成
        } catch (err) {
            throw new Error(`分块上传失败：${err.message}`);
        }
    }

    add(fileData, fileName, fileKey, isNeedMerge) {
        return new Promise(async (resolve, reject) => {
            // 如果目前并发数量小于最大数量，先入队列
            if (this.fileRunningCount < this.maxRunningCount && !this.fileRunningQueue.includes(fileKey)) {
                this.fileRunningQueue.push(fileKey)
                this.fileRunningCount++
            }
            // 如果队列中该块的文件正在上传，异步上传当前分块
            if (this.fileRunningQueue.includes(fileKey)) {
                await this.uploadSingleChunk(fileData);
            }
            // 否则就将块加入等待队列中
            if (!this.fileChunkWaitingQueue.has(fileKey)) {
                this.fileChunkWaitingQueue.set(fileKey, {
                    fileDataList: [], // 存储该文件的所有分块
                    isNeedMerge: false
                })
            }
            const fileQueue = this.fileChunkWaitingQueue.get(fileKey)
            fileQueue.fileDataList.push(fileData)
            fileQueue.isNeedMerge = fileQueue.isNeedMerge || isNeedMerge
            // 如果收到合并请求的块
            if (isNeedMerge) {
                // 先上传该文件的所有分块
                const allChunks = fileQueue.fileDataList;
                for (const chunk of allChunks) {
                    await this.uploadSingleChunk(chunk);
                }
                // 调用合并接口
                await this.mergeFile(fileKey, fileName);
                console.info(fileKey + '合并')

                // 合并完成后，清理队列+释放并发
                this.fileRunningQueue = this.fileRunningQueue.filter(key => key !== fileKey);
                this.fileRunningCount--;
                this.fileChunkWaitingQueue.delete(fileKey); // 清理分块队列
            }

            // 添加队列成功尝试运行
            this.run()
            resolve(`文件${fileKey}分块处理完成`);
        })
    }

    run() {
        if (this.fileRunningCount >= this.maxRunningCount) return;

        // 遍历等待队列，找第一个可执行的文件
        for (const fileKey of this.fileChunkWaitingQueue.keys()) {
            if (!this.fileRunningQueue.includes(fileKey)) {
                this.fileRunningQueue.push(fileKey);
                this.fileRunningCount++;
                // 异步上传该文件的所有分块
                this.uploadFileAllChunks(fileKey);
                break;
            }
        }
    }

    async uploadFileAllChunks(fileKey) {
        const fileQueue = this.fileChunkWaitingQueue.get(fileKey);
        if (!fileQueue) return;

        // 上传所有分块
        for (const chunk of fileQueue.fileDataList) {
            await this.uploadSingleChunk(chunk);
        }

        // 如果需要合并，执行合并并清理
        if (fileQueue.isNeedMerge) {
            await mergeFileApi(fileKey);
            this.fileRunningQueue = this.fileRunningQueue.filter(key => key !== fileKey);
            this.fileRunningCount--;
            this.fileChunkWaitingQueue.delete(fileKey);
            // 合并完成后继续补位
            this.run();
        }
    }

    async mergeFile(fileHash, fileName) {
        await mergeFileChunkApi(fileHash, fileName).then((res) => {
            console.info('合并成功')
        })
    }

}
