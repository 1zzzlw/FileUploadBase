importScripts('./computedFileChunkHash.js')

// 接收信息
onmessage = async (e) => {
    const { file, CHUNK_SIZE, start, end, doneUploadChunkList } = e.data

    let result = []

    // 遍历每个线程的起始位置，即可获得线程内部的每个文件块
    for (let index = start; index < end; index++) {

        if (doneUploadChunkList.includes(index)) {
            console.info('已经有了~~~')
            result.push({
                chunkIndex: index,
                chunkHash: null,
                chunkArrayBuffer: null,
                chunkBlob: null,
                isUploaded: true,
            })
            continue
        }

        const chunkData = await computedFileChunkHash({
            file,
            index,
            CHUNK_SIZE
        })

        console.info(chunkData)

        result.push(chunkData)
    }

    const chunks = await Promise.all(result)

    postMessage(chunks)
}