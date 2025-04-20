# text-tint
A silly toy that matches a colour RGB to any word.

This is an off-cut from my [word2color experiment](https://www.mixedmeanings.lol/code/word2color) ([kaggle notebook](https://www.kaggle.com/code/anyaepie/word2color-seeing-books-in-a-new-colour)). I do have some ideas on how to move it forward, yet it will stay like that for some time.

Quickly coded in P5JS (front, gui), Google Cloud Function (serverless back-end in Python) and Qdrant (vector database, managed cloud, Free tier) with Google [text-embedding004](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api) as the embedding model.

What if every word had a color?
Not by design — but as a byproduct of humans naming colors, and then teaching machines to understand language.

As large language models learned that “lonely” and “isolation” are close (and that “cat” and “keyboard” weirdly hang out a lot too — thanks, internet), it became possible to connect color names to any word.
The result is a little weird. Sometimes rude. But also kind of beautiful.

So go ahead. Type a sentence.

See how “truth” might show up as beige. Or how “work” ends up shipyard blue. “Sacred” could be Holy Crow. But “is”? Apparently… shit brown.

This isn’t meant to be useful. It’s meant to make you tilt your head and go: huh.

Data sources used: [color_names](https://github.com/meodai/color-names), Wikipedia, XKCD Color Survey - both from [corpora](https://github.com/dariusk/corpora/tree/master/data/colors), also updates from [Meodai](https://github.com/meodai/wikipedia-color-names).

