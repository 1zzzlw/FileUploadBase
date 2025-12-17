importScripts('./spark-md5.js')

function computedFileChunkHash(data) {
    return new Promise((resolve) => {
        // 收到总文件，以及块的索引，块的尺寸
        const { file, index, CHUNK_SIZE, fileTaskMap, fileKey } = data

        // 每个块的开始尺寸
        const start = index * CHUNK_SIZE

        // 每个块的结束尺寸
        let end = start + CHUNK_SIZE

        if (end > file.size) end = file.size

        // 根据块的起始尺寸来分割出来该块
        const blob = file.slice(start, end)

        // 创建文件的读取器
        const fileReader = new FileReader()

        const chunkSpark = new SparkMD5.ArrayBuffer();

        // 异步执行不阻塞
        fileReader.onload = (e) => {
            const arraybuffer = e.target.result

            chunkSpark.append(arraybuffer)

            const chunkHash = chunkSpark.end()

            const fileTask = fileTaskMap.get(fileKey);

            fileTask.chunkIndex = index
            fileTask.chunkHash = chunkHash
            fileTask.chunkArrayBuffer = arraybuffer
            fileTask.chunkBlob = blob

            resolve(fileTaskMap)
        }

        // 读取blob为二进制的 ArrayBuffer 格式，读取完成之后执行onload
        fileReader.readAsArrayBuffer(blob)

        // console.info(`文件块${index}的blob对象 =======> ${blob}`)
    })
}