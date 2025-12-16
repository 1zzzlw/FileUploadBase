importScripts('./computedFileChunkHash.js')

// 接收信息
onmessage = async (e) => {
    const { file, CHUNK_SIZE, start, end } = e.data

    let result = []

    // 遍历每个线程的起始位置，即可获得线程内部的每个文件块
    for (let index = start; index < end; index++) {

        const chunkData = await computedFileChunkHash({
            file,
            index,
            CHUNK_SIZE
        })

        result.push(chunkData)
    }

    const chunks = await Promise.all(result)

    postMessage(chunks)
}